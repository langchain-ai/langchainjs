# OpenSearch

Langchain.js accepts [@opensearch-project/opensearch](https://opensearch.org/docs/latest/clients/javascript/index/)
as the client for OpenSearch vectorstore. Install the client with

```bash npm2yarn
npm install -S dotenv langchain @opensearch-project/opensearch
```

## Index docs

```typescript
import { Client } from "@opensearch-project/opensearch";
import * as dotenv from "dotenv";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { OpenSearchVectorStore } from "langchain/vectorstores";

dotenv.config();

const client = new Client({
  nodes: [process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200"],
});

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "opensearch is also a vector db",
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
    pageContent: "OpenSearch is a scalable, flexible, and extensible open-source software suite for search, analytics, and observability applications",
  }),
];

await OpenSearchVectorStore.fromDocuments(docs, new OpenAIEmbeddings(), {
  client,
  indexName: process.env.OPENSEARCH_INDEX, // Will default to `documents`
});
```

## Query docs

```typescript
import { Client } from "@opensearch-project/opensearch";
import * as dotenv from "dotenv";
import { VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { OpenAI } from "langchain/llms";
import { OpenSearchVectorStore } from "langchain/vectorstores";

dotenv.config();

const client = new Client({
  nodes: [process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200"],
});

const vectorStore = new OpenSearchVectorStore(new OpenAIEmbeddings(), {
  client,
});

/* Search the vector DB independently with meta filters */
const results = await vectorStore.similaritySearch("hello world", 1);
console.log(JSON.stringify(results, null, 2));
/* [
    {
      "pageContent": "Hello world",
      "metadata": {
        "id": 2
      }
    }
  ] */

/* Use as part of a chain (currently no metadata filters) */
const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  k: 1,
  returnSourceDocuments: true,
});
const response = await chain.call({ query: "What is opensearch?" });
console.log(JSON.stringify(response, null, 2));
/* 
  {
    "text": " Opensearch is a collection of technologies that allow search engines to publish search results in a standard format, making it easier for users to search across multiple sites.",
    "sourceDocuments": [
      {
        "pageContent": "What's this?",
        "metadata": {
          "id": 3
        }
      }
    ]
  } 
  */
```
