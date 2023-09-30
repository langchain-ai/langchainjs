---
sidebar_class_name: node-only
---

# Pinecone

:::tip Compatibility
Only available on Node.js.
:::

LangChain.js accepts [@pinecone-database/pinecone](https://docs.pinecone.io/docs/node-client) as the client for Pinecone vectorstore. Install the library with:

```bash npm2yarn
npm install -S dotenv @pinecone-database/pinecone
```

## Index docs

```typescript
import { PineconeClient } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";

dotenv.config();

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});
const pineconeIndex = client.Index(process.env.PINECONE_INDEX);

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "pinecone is a vector db",
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
    pageContent: "pinecones are the woody fruiting body and of a pine tree",
  }),
];

await PineconeStore.fromDocuments(docs, new OpenAIEmbeddings(), {
  pineconeIndex,
  maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
});
```

## Query docs

```typescript
import { PineconeClient } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
import { VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";

dotenv.config();

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});
const pineconeIndex = client.Index(process.env.PINECONE_INDEX);

const vectorStore = await PineconeStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  { pineconeIndex }
);

/* Search the vector DB independently with meta filters */
const results = await vectorStore.similaritySearch("pinecone", 1, {
  foo: "bar",
});
console.log(results);
/*
[
  Document {
    pageContent: 'pinecone is a vector db',
    metadata: { foo: 'bar' }
  }
]
*/

/* Use as part of a chain (currently no metadata filters) */
const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  k: 1,
  returnSourceDocuments: true,
});
const response = await chain.call({ query: "What is pinecone?" });
console.log(response);
/*
{
  text: ' A pinecone is the woody fruiting body of a pine tree.',
  sourceDocuments: [
    Document {
      pageContent: 'pinecones are the woody fruiting body and of a pine tree',
      metadata: [Object]
    }
  ]
}
*/
```

## Delete docs

```typescript
import { PineconeClient } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";

dotenv.config();

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});
const pineconeIndex = client.Index(process.env.PINECONE_INDEX);
const embeddings = new OpenAIEmbeddings();
const pineconeStore = new PineconeStore(embeddings, { pineconeIndex });

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "pinecone is a vector db",
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
    pageContent: "pinecones are the woody fruiting body and of a pine tree",
  }),
];

// Also takes an additional {ids: []} parameter for upsertion
const ids = await pineconeStore.addDocuments(docs);

const results = await pineconeStore.similaritySearch(pageContent, 2, {
  foo: "bar",
});

console.log(results);
/*
[
  Document {
    pageContent: 'pinecone is a vector db',
    metadata: { foo: 'bar' },
  },
  Document {
    pageContent: "the quick brown fox jumped over the lazy dog",
    metadata: { foo: "bar" },
  }
]
*/

await pineconeStore.delete({
  ids: [ids[0], ids[1]],
});

const results2 = await pineconeStore.similaritySearch(pageContent, 2, {
  foo: "bar",
});

console.log(results2);
/*
  []
*/
```
