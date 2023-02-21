# Vectorstores

A vectorstore is a particular type of database optimized for storing documents, embeddings, and then allowing for fetching of the most relevant documents for a particular query.

```typescript
import { HNSWLib } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

const vectorStore = await HNSWLib.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

const resultOne = await vectorStore.similaritySearch("hello world", 1);
```

## Pinecone vectorstore

Langchain.js accepts [pinecone-client](https://github.com/rileytomasek/pinecone-client) as the client for Pinecone vectorstore. Install the library with `npm install -S pinecone-client`.

```typescript
import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "pinecone-client";

const client = new PineconeClient({});

const vectorStore = await PineconeStore.fromTexts(
  client,
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

const resultOne = await vectorStore.similaritySearch("Hello world", 2);
```
