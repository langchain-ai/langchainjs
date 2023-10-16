---
sidebar_class_name: node-only
---

# OpenSearch

:::tip Compatibility
Only available on Node.js.
:::

[OpenSearch](https://opensearch.org/) is a fork of [Elasticsearch](https://www.elastic.co/elasticsearch/) that is fully compatible with the Elasticsearch API. Read more about their support for Approximate Nearest Neighbors [here](https://opensearch.org/docs/latest/search-plugins/knn/approximate-knn/).

Langchain.js accepts [@opensearch-project/opensearch](https://opensearch.org/docs/latest/clients/javascript/index/) as the client for OpenSearch vectorstore.

## Setup

```bash npm2yarn
npm install -S @opensearch-project/opensearch
```

You'll also need to have an OpenSearch instance running. You can use the [official Docker image](https://opensearch.org/docs/latest/opensearch/install/docker/) to get started. You can also find an example docker-compose file [here](https://github.com/langchain-ai/langchainjs/blob/main/examples/src/indexes/vector_stores/opensearch/docker-compose.yml).

## Index docs

```typescript
import { Client } from "@opensearch-project/opensearch";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";

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
    pageContent:
      "OpenSearch is a scalable, flexible, and extensible open-source software suite for search, analytics, and observability applications",
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
import { VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";

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
