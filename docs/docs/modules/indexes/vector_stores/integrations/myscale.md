---
sidebar_class_name: node-only
---

# MyScale

[MyScale](https://myscale.com/) is an emerging AI database that harmonizes the power of vector search and SQL analytics, providing a managed, efficient, and responsive experience.

:::tip Compatibility
Only available on Node.js.
:::

## Setup

1. Launch a cluster through [MyScale's Web Console](https://console.myscale.com/), see [the MyScale documentation](https://docs.myscale.com/en/quickstart/) for more information.
2. Install the Node.js SDK.

```bash npm2yarn
npm install -S @clickhouse/client
```

## Index and query docs

```typescript
import { MyScaleStore } from "langchain/vectorstores/myscale";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await MyScaleStore.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [
    { id: 2, name: "2" },
    { id: 1, name: "1" },
    { id: 3, name: "3" },
  ],
  new OpenAIEmbeddings(),
  {
    host: process.env.MYSCALE_HOST || "https://localhost:8443",
    username: process.env.MYSCALE_USERNAME || "username",
    password: process.env.MYSCALE_PASSWORD || "password",
  }
);

const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
```

## Query docs from existing collection

```typescript
import { MyScaleStore } from "langchain/vectorstores/myscale";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await MyScaleStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  {
    host: process.env.MYSCALE_HOST || "https://localhost:8443",
    username: process.env.MYSCALE_USERNAME || "username",
    password: process.env.MYSCALE_PASSWORD || "password",
    database: "your_database", // default is default
    table: "your_table", // default is vector_table
  }
);

const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
```
