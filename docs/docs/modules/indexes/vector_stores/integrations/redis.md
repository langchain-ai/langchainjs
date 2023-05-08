---
sidebar_class_name: node-only
---

# Redis

[Redis](https://redis.io/) is a fast open source, in-memory data store.
As part of the [Redis Stack](https://redis.io/docs/stack/get-started/), [RediSearch](https://redis.io/docs/stack/search/) is the module that enables vector similarity semantic search, as well as many other types of searching.

:::tip Compatibility
 Only available on Node.js.
:::

Langchain.js accepts [node-redis](https://github.com/redis/node-redis) as the client for Redis vectorstore.

## Setup

1. Run Redis with Docker on your computer following [the docs](https://redis.io/docs/stack/get-started/install/docker/#redisredis-stack)
2. Install the node-redis JS client

```bash npm2yarn
npm install -S redis
```

## Index docs

```typescript
import { createClient, RedisClientType } from "redis";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RedisVectorStore } from "langchain/vectorstores/redis";

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await client.connect();

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "redis is fast",
  }),
  new Document({
    metadata: { foo: "bar" },
    pageContent: "the quick brown fox jumped over the lazy dog",
  }),
  new Document({
    metadata: { baz: "qux" },
    pageContent: "lorem ipsum dolor sit amet",
  }),
  new Document({
    metadata: { baz: "qux" },
    pageContent: "consectetur adipiscing elit",
  }),
];

await RedisVectorStore.fromDocuments(docs, new OpenAIEmbeddings(), {
  redisClient: client as RedisClientType,
  indexName: "docs",
});
```

## Query docs

```typescript
import { createClient, RedisClientType } from "redis";
import { Document } from "langchain/document";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { VectorDBQAChain } from "langchain/chains";
import { RedisVectorStore } from "langchain/vectorstores/redis";

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await client.connect();

const vectorStore = new RedisVectorStore(new OpenAIEmbeddings(), {
  redisClient: client as RedisClientType,
  indexName: "docs",
});

/* Simple standalone search in the vector DB */
const simpleRes = await vectorStore.similaritySearch("redis", 1);
console.log(simpleRes);
/*
[
  Document {
    pageContent: "redis is fast",
    metadata: { foo: "bar" }
  }
]
*/

/* Search in the vector DB using filters */
const filterRes = await vectorStore.similaritySearch("redis", 3, ["qux"]);
console.log(filterRes);
/*
[
  Document {
    pageContent: "consectetur adipiscing elit",
    metadata: { baz: "qux" },
  },
  Document {
    pageContent: "lorem ipsum dolor sit amet",
    metadata: { baz: "qux" },
  }
]
*/

/* Usage as part of a chain */
const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  k: 1,
  returnSourceDocuments: true,
});
const chainRes = await chain.call({ query: "What did the fox do?" });
console.log(chainRes);
/*
{
  text: " The fox jumped over the lazy dog.",
  sourceDocuments: [
    Document {
      pageContent: "the quick brown fox jumped over the lazy dog",
      metadata: [Object]
    }
  ]
}
*/
```
