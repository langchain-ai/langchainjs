# @langchain/valkey

This package contains the LangChain.js integrations for Valkey through the valkey-glide client.

## Installation

```bash npm2yarn
npm install @langchain/valkey @langchain/core
```

## Vector Store

The Valkey vector store supports similarity search with optional metadata filtering using indexed fields.

### Basic Usage

```typescript
import { ValkeyVectorStore } from "@langchain/valkey";
import { OpenAIEmbeddings } from "@langchain/openai";
import { GlideClient } from "@valkey/valkey-glide";

const client = await GlideClient.createClient({
  addresses: [{ host: "localhost", port: 6379 }],
});

const vectorStore = new ValkeyVectorStore(new OpenAIEmbeddings(), {
  valkeyClient: client,
  indexName: "my-index",
});

await vectorStore.addDocuments([
  { pageContent: "Hello world", metadata: { source: "doc1" } },
]);

const results = await vectorStore.similaritySearch("Hello", 5);
```

### Indexed Metadata Fields

Define indexed fields using `customSchema` to enable metadata filtering:

```typescript
import { ValkeyVectorStore, SchemaFieldTypes } from "@langchain/valkey";

const vectorStore = new ValkeyVectorStore(new OpenAIEmbeddings(), {
  valkeyClient: client,
  indexName: "products",
  customSchema: {
    category: { type: SchemaFieldTypes.TAG },
    price: { type: SchemaFieldTypes.NUMERIC },
    tags: { type: SchemaFieldTypes.TAG, SEPARATOR: "," },
  },
});

await vectorStore.addDocuments([
  { 
    pageContent: "Laptop", 
    metadata: { category: "electronics", price: 999, tags: ["computer", "portable"] } 
  },
  { 
    pageContent: "Book", 
    metadata: { category: "books", price: 19 } 
  },
]);
```

### Filtering

Filter by indexed fields using `similaritySearchVectorWithScoreAndMetadata`:

```typescript
const embeddings = new OpenAIEmbeddings();
const query = await embeddings.embedQuery("products");

// Filter by TAG field
const results = await vectorStore.similaritySearchVectorWithScoreAndMetadata(
  query,
  10,
  { category: "electronics" }
);

// Filter by NUMERIC range
const results = await vectorStore.similaritySearchVectorWithScoreAndMetadata(
  query,
  10,
  { price: { min: 100, max: 1000 } }
);

// Combined filters
const results = await vectorStore.similaritySearchVectorWithScoreAndMetadata(
  query,
  10,
  { 
    category: "electronics", 
    price: { min: 500 } 
  }
);
```

### Schema Field Options

- **TAG**: Exact match filtering, supports arrays
  - `SEPARATOR`: Character to delimit tags (default: `,`)
  - `CASESENSITIVE`: Case-sensitive matching (default: `false`)
- **NUMERIC**: Range queries with min/max
- **required**: Validate field presence before adding documents

### TTL Support

```typescript
const vectorStore = new ValkeyVectorStore(new OpenAIEmbeddings(), {
  valkeyClient: client,
  indexName: "temp-index",
  ttl: 3600, // Documents expire after 1 hour
});
```

## Development

To develop the Valkey package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/valkey
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
