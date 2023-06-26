---
sidebar_class_name: node-only
---

# Elasticsearch

:::tip Compatibility
Only available on Node.js.
:::

[Elasticsearch](https://github.com/elastic/elasticsearch) is a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads. It supports also vector search using the [k-nearest neighbor](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) (kNN) algorithm and also [custom models for Natural Language Processing](https://www.elastic.co/blog/how-to-deploy-nlp-text-embeddings-and-vector-search) (NLP).
You can read more about the support of vector search in Elasticsearch [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/knn-search.html).

Langchain.js accepts [@elastic/elasticsearch](https://github.com/elastic/elasticsearch-js) as the client for Elasticsearch vectorstore.

## Setup

```bash npm2yarn
npm install -S @elastic/elasticsearch
```

You'll also need to have an Elasticsearch instance running. You can use the [official Docker image](https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html) to get started. You can also use [Elastic Cloud](https://www.elastic.co/cloud/)
the official cloud service provided by Elastic.

## Index docs

```typescript
import { Client } from "@elastic/elasticsearch";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ElasticsearchVectorStore } from "langchain/vectorstores/elasticsearch";

const config: any = {
  node: process.env.ELASTICSEARCH_URL,
};
if (process.env.ELASTICSEARCH_API_KEY) {
  config.auth = {
    apiKey: process.env.ELASTICSEARCH_API_KEY,
  };
}
const client = new Client(config);

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "Elasticsearch is a powerful vector db",
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
      "Elasticsearch a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
  }),
];

const embeddings = new OpenAIEmbeddings(undefined, {
  baseOptions: { temperature: 0 },
});
await ElasticsearchVectorStore.fromDocuments(docs, embeddings, {
  client,
  indexName: process.env.ELASTICSEARCH_INDEX ?? "test_vectorstore",
});
```

## Query docs

```typescript
import { Client } from "@elastic/elasticsearch";
import { VectorDBQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { ElasticsearchVectorStore } from "langchain/vectorstores/elasticsearch";

const config: any = {
  node: process.env.ELASTICSEARCH_URL,
};
if (process.env.ELASTICSEARCH_API_KEY) {
  config.auth = {
    apiKey: process.env.ELASTICSEARCH_API_KEY,
  };
}
const client = new Client(config);

const embeddings = new OpenAIEmbeddings(undefined, {
  baseOptions: { temperature: 0 },
});

const vectorStore = new ElasticsearchVectorStore(embedding, client);

/* Search the vector DB independently with meta filters */
const results = await vectorStore.similaritySearch("animal jump", 1);
console.log(JSON.stringify(results, null, 2));
/* [
      {
        "pageContent": "the quick brown fox jumped over the lazy dog",
        "metadata": {
          "foo": "bar"
        }
      }
   ]
*/

/* Use as part of a chain (currently no metadata filters) */
const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  k: 1,
  returnSourceDocuments: true,
});
const response = await chain.call({ query: "What is Elasticsearch?" });

console.log(JSON.stringify(response, null, 2));
/* 
  {
    "text": " Elasticsearch is a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
    "sourceDocuments": [
      {
        "pageContent": "Elasticsearch a distributed, RESTful search engine optimized for speed and relevance on production-scale workloads.",
        "metadata": {
          "baz": "qux"
        }
      }
    ]
  }
  */
```
