# @langchain/turbopuffer

This package contains the LangChain.js integration for the [turbopuffer](https://turbopuffer.com/) vector database.

## Installation

```bash
npm install @langchain/turbopuffer @turbopuffer/turbopuffer
```

## Usage

```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { TurbopufferVectorStore } from "@langchain/turbopuffer";
import { OpenAIEmbeddings } from "@langchain/openai";

const client = new Turbopuffer({ apiKey: process.env.TURBOPUFFER_API_KEY });

const vectorStore = new TurbopufferVectorStore(new OpenAIEmbeddings(), {
  namespace: client.namespace("my-namespace"),
});

const ids = await vectorStore.addDocuments([
  { pageContent: "Hello world", metadata: { source: "greeting" } },
]);

const results = await vectorStore.similaritySearch("hello", 1);

await vectorStore.delete({ ids });
```

### Configuration

| Option           | Description                                   | Default             |
| ---------------- | --------------------------------------------- | ------------------- |
| `namespace`      | A configured turbopuffer `Namespace` instance | Required            |
| `distanceMetric` | `"cosine_distance"` or `"euclidean_squared"`  | `"cosine_distance"` |

### Add Options

| Option      | Description              | Default              |
| ----------- | ------------------------ | -------------------- |
| `ids`       | Custom IDs for documents | Auto-generated UUIDs |
| `batchSize` | Batch size for upserts   | `3000`               |

### Filtering

```typescript
const results = await vectorStore.similaritySearch("query", 10, [
  "category",
  "Eq",
  "books",
]);
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm test:int
pnpm lint && pnpm format
```
