# @langchain/ydb

This package contains the [LangChain.js](https://github.com/langchain-ai/langchainjs) integration for [YDB](https://ydb.tech), a distributed SQL database with built-in vector search via `Knn::*` UDFs.

## Installation

```bash
npm install @langchain/ydb @langchain/core @ydbjs/core @ydbjs/query @ydbjs/value
```

You will also need a running YDB instance. You can use the official Docker image:

```bash
docker run -d \
  --name ydb \
  -p 2136:2136 \
  -p 8765:8765 \
  -e YDB_USE_IN_MEMORY_PDISKS=true \
  cr.yandex/yc/yandex-docker-local-ydb:latest
```

## Usage

### Basic Setup

```typescript
import { YDBVectorStore } from "@langchain/ydb";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings();

// Using a connection string (store manages the Driver internally)
const store = new YDBVectorStore(embeddings, {
  connectionString: "grpc://localhost:2136/local",
});
```

### Adding Documents

```typescript
import { Document } from "@langchain/core/documents";

await store.addDocuments([
  new Document({ pageContent: "LangChain supports YDB", metadata: { source: "docs" } }),
  new Document({ pageContent: "YDB is a distributed database", metadata: { source: "wiki" } }),
]);
```

### Similarity Search

```typescript
const results = await store.similaritySearch("distributed database", 4);
console.log(results);
```

### Similarity Search with Score

```typescript
const resultsWithScore = await store.similaritySearchWithScore("YDB", 4);
for (const [doc, score] of resultsWithScore) {
  console.log(`Score: ${score}, Content: ${doc.pageContent}`);
}
```

### Metadata Filtering

```typescript
const results = await store.similaritySearch("database", 5, { source: "wiki" });
```

Multiple keys are combined with `AND`:

```typescript
const results = await store.similaritySearch("query", 5, {
  source: "docs",
  lang: "en",
});
```

### Using a Pre-built Driver

```typescript
import { Driver } from "@ydbjs/core";
import { YDBVectorStore } from "@langchain/ydb";

const driver = new Driver("grpc://localhost:2136/local");
await driver.ready();

const store = new YDBVectorStore(embeddings, { driver });
// ... use the store ...
await driver.close();
```

### Deleting Documents

```typescript
// Delete by IDs
await store.delete({ ids: ["doc1", "doc2"] });

// Delete all documents
await store.delete({ deleteAll: true });
```

### Vector Index (ANN)

For large datasets, enable the approximate nearest-neighbour index:

```typescript
const store = new YDBVectorStore(embeddings, {
  connectionString: "grpc://localhost:2136/local",
  indexEnabled: true,
  vectorDimension: 1536,
});

await store.addDocuments(docs);
await store.createVectorIndex(); // build the index after initial load
```

### Search Strategies

```typescript
import { YDBVectorStore, YDBSearchStrategy } from "@langchain/ydb";

const store = new YDBVectorStore(embeddings, {
  connectionString: "grpc://localhost:2136/local",
  strategy: YDBSearchStrategy.CosineDistance, // default: CosineSimilarity
});
```

Available strategies: `CosineSimilarity`, `InnerProductSimilarity`, `CosineDistance`, `EuclideanDistance`, `ManhattanDistance`.

### Closing the Store

When using a connection string, call `close()` to release the internal driver:

```typescript
store.close();
```

## Development

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

### Run tests

```bash
pnpm test
pnpm test:int
```

### Lint & Format

```bash
pnpm lint && pnpm format
```
