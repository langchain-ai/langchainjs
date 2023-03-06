# Pinecone

Langchain.js accepts [@pinecone-database/pinecone](https://docs.pinecone.io/docs/node-client) as the client for Pinecone vectorstore. Install the library with `npm install -S @pinecone-database/pinecone`.

## Index docs

```typescript
import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "@pinecone-database/pinecone";

const pinecone = new PineconeClient();
await pinecone.init({
  environment: "us-west1-gcp",
  apiKey: "apiKey",
});
const index = pinecone.Index("my-index");
await PineconeStore.fromDocuments(index, docs, new OpenAIEmbeddings());
```

## Query docs

```typescript
import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "@pinecone-database/pinecone";
import { VectorDBQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms";

const pinecone = new PineconeClient();
await pinecone.init({
  environment: "us-west1-gcp",
  apiKey: "apiKey",
});
const index = pinecone.Index("my-index");
const vectorStore = await PineconeStore.fromExistingIndex(
  index,
  new OpenAIEmbeddings()
);

const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore);
const response = await chain.call({
  query: "what does the doc say about pinecone",
});
```
