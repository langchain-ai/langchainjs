---
sidebar_class_name: node-only
---

# Vectara

Vectara is a developer-first API platform for easily building conversational search experiences.

You can use Vectara as a vectorstore with Langchain.js.

## 👉 Embeddings included

Vectara uses its own embeddings under the hood, so you don't have to provide any yourself.

This also means that if you provide your own embeddings, they'll be a no-op.

```typescript
const store = await VectaraStore.fromTexts(
  ["hello world", "hi there"],
  [{ foo: "bar" }, { foo: "baz" }],
  // This won't have an effect. Provide a FakeEmbeddings instance instead.
  new OpenAIEmbeddings(),
  args
);
```

## Getting started

You'll need to:

- Create a [free Vectara account](https://console.vectara.com/signup).
- Create a [corpus](https://docs.vectara.com/docs/console-ui/creating-a-corpus) to store your data
- Create an [API key](https://docs.vectara.com/docs/common-use-cases/app-authn-authz/api-keys) with QueryService and IndexService access so you can access this corpus

Configure your `.env` file or provide args to connect your vectorstore to your Vectara corpus:

```
VECTARA_CUSTOMER_ID=your_customer_id
VECTARA_CORPUS_ID=your_corpus_id
VECTARA_API_KEY=your-vectara-api-key
```

### Store data

```typescript
import { VectaraStore, VectaraLibArgs } from "langchain/vectorstores/vectara";

// Create the store.
const store = new VectaraStore({
  customer_id: Number(process.env.VECTARA_CUSTOMER_ID),
  corpus_id: Number(process.env.VECTARA_CORPUS_ID),
  api_key: process.env.VECTARA_API_KEY,
});

// Store your data.
const indexResult = await store.addDocuments([
  new Document({
    pageContent: "In the room the women come and go talking of Michelangelo",
    metadata: {
      foo: "bar",
    },
  }),
  new Document({
    pageContent: "Do I dare to eat a peach?",
    metadata: {
      foo: "baz",
    },
  }),
]);
```

### Query data

```typescript
const resultsWithScore = await store.similaritySearchWithScore(
  "What were the women talking about?",
  {
    noOfResults: 1,
    lambda: 0.025,
  }
);
```

## APIs

The Vectara vectorstore consumes Vectara's core APIs:

- [Indexing API](https://docs.vectara.com/docs/indexing-apis/indexing) for storing documents in a Vectara corpus.
- [Search API](https://docs.vectara.com/docs/search-apis/search) for querying this data. This API supports hybrid search.
