# @langchain/pgvector

This package contains the [LangChain.js](https://github.com/langchain-ai/langchainjs) integration for [pgvector](https://github.com/pgvector/pgvector), the open-source vector similarity search extension for PostgreSQL.

## Installation

```bash
npm install @langchain/pgvector @langchain/core pg
```

You will also need a running PostgreSQL instance with the `pgvector` extension installed. You can use the official Docker image:

```bash
docker run -d \
  --name pgvector \
  -e POSTGRES_DB=api \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=ChangeMe \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

## Usage

### Basic Setup

```typescript
import { PGVectorStore, DistanceStrategy } from "@langchain/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PoolConfig } from "pg";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const config = {
  postgresConnectionOptions: {
    host: "127.0.0.1",
    port: 5432,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig,
  tableName: "documents",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
  distanceStrategy: "cosine" as DistanceStrategy,
};

const vectorStore = await PGVectorStore.initialize(embeddings, config);
```

### Adding Documents

```typescript
import { Document } from "@langchain/core/documents";

const documents = [
  new Document({
    pageContent: "LangChain is great",
    metadata: { source: "docs" },
  }),
  new Document({
    pageContent: "pgvector is powerful",
    metadata: { source: "blog" },
  }),
];

await vectorStore.addDocuments(documents, { ids: ["doc1", "doc2"] });
```

### Similarity Search

```typescript
const results = await vectorStore.similaritySearch("LangChain", 2);
console.log(results);
```

### Similarity Search with Score

```typescript
const resultsWithScore = await vectorStore.similaritySearchWithScore(
  "LangChain",
  2
);
for (const [doc, score] of resultsWithScore) {
  console.log(`Score: ${score}, Content: ${doc.pageContent}`);
}
```

### Filtering

Use simple equality filters or advanced operator filters:

```typescript
// Simple equality filter
const filtered = await vectorStore.similaritySearch("query", 5, {
  source: "docs",
});

// Advanced filter operators
const advanced = await vectorStore.similaritySearch("query", 5, {
  source: { in: ["docs", "blog"] },
  score: { gte: 80 },
});
```

Available filter operators: `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `neq`, `arrayContains`.

### Deleting Documents

```typescript
// Delete by IDs
await vectorStore.delete({ ids: ["doc1"] });

// Delete by metadata filter
await vectorStore.delete({ filter: { source: "blog" } });
```

### Using as a Retriever

```typescript
const retriever = vectorStore.asRetriever({
  searchType: "mmr",
  k: 5,
});

const docs = await retriever.invoke("What is LangChain?");
```

### HNSW Index

Create an HNSW index for faster approximate nearest neighbor search:

```typescript
await vectorStore.createHnswIndex({
  dimensions: 1536,
  m: 16,
  efConstruction: 64,
});
```

### Score Normalization

By default, raw distance values are returned (lower = more similar). Set `scoreNormalization` to `"similarity"` to get normalized similarity scores (higher = more similar):

```typescript
const store = await PGVectorStore.initialize(embeddings, {
  ...config,
  scoreNormalization: "similarity",
});
```

### Collections

Organize vectors into collections for multi-tenant or namespaced setups:

```typescript
const store = await PGVectorStore.initialize(embeddings, {
  ...config,
  collectionTableName: "langchain_collections",
  collectionName: "my_collection",
});
```

### Distance Strategies

Three distance strategies are supported:

- `"cosine"` (default) — Cosine distance
- `"innerProduct"` — Inner product distance
- `"euclidean"` — Euclidean (L2) distance

## Development

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
pnpm build --filter @langchain/pgvector
```

### Run tests

Test files should live within a `tests/` folder in the `src/` directory. Unit tests should end in `.test.ts` and integration tests should end in `.int.test.ts`:

```bash
pnpm test
pnpm test:int
```

### Lint & Format

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
