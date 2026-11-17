# @langchain/qdrant

This package contains the LangChain.js integration for the [Qdrant](https://qdrant.tech/) vector database.

## Installation

```bash
npm install @langchain/qdrant
```

## Usage

```typescript
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";

const vectorStore = await QdrantVectorStore.fromExistingCollection(
  new OpenAIEmbeddings(),
  { url: process.env.QDRANT_URL, collectionName: "documents" }
);

const docs = await vectorStore.similaritySearch("hello", 4);
```

### Hybrid and sparse retrieval

Besides the default `"dense"` mode, `retrievalMode` can be `"sparse"` (a
sparse vector only) or `"hybrid"` (dense and sparse vectors, fused by Qdrant's
Query API). `similaritySearch`, `similaritySearchWithScore` and `asRetriever()`
use the selected mode.

```typescript
const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "hybrid-docs",
  retrievalMode: "hybrid", // "dense" (default) | "sparse" | "hybrid"
  // Server-side BM25 (default when `sparseEmbeddings` is not set)
  sparseDocumentOptions: {
    model: "qdrant/bm25",
    options: { language: "english" },
  },
  // Or client-side sparse vectors:
  // sparseEmbeddings: mySparseEmbeddings, // implements SparseEmbeddingsInterface
  hybridFusion: { fusion: "rrf" }, // default
});
```

| Option                  | Default                    | Notes                                                                                |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `retrievalMode`         | `"dense"`                  | `"dense"`, `"sparse"` or `"hybrid"`                                                  |
| `vectorName`            | `""` (unnamed)             | name of the dense vector                                                             |
| `sparseVectorName`      | `"langchain-sparse"`       | name of the sparse vector                                                            |
| `sparseEmbeddings`      | —                          | computes sparse vectors on the client; when unset, Qdrant computes them              |
| `sparseDocumentOptions` | `{ model: "qdrant/bm25" }` | server-side model and options (`language`, `k`, `b`, `avg_len`, ...)                 |
| `hybridFusion`          | `{ fusion: "rrf" }`        | any Qdrant fusion query, e.g. `{ fusion: "dbsf" }` or `{ rrf: { weights: [1, 2] } }` |

Notes:

- Server-side BM25 needs Qdrant >= 1.15.3; with `sparseEmbeddings`, Qdrant >= 1.10
  is enough. Weighted RRF needs Qdrant >= 1.17.
- A sparse vector cannot be added to an existing collection: `sparse` and
  `hybrid` mode need a collection created with it. When the store creates the
  collection, it adds the sparse vector (with the `idf` modifier for
  server-side BM25). A collection created in `hybrid` mode can still be queried
  in `dense` mode.
- In `hybrid` mode, scores are fusion scores, not similarities, so score
  thresholds are not meaningful.
- `similaritySearchVectorWithScore` and `maxMarginalRelevanceSearch` always
  search the dense vector, and throw in `sparse` mode, as does `addVectors`.

## Development

To develop the this package, you'll need to follow these instructions:

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

Or from the repo root:

```bash
pnpm build --filter @langchain/qdrant
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ pnpm test
$ pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
