# Chroma

Chroma is an open-source Apache 2.0 embedding database.

Use [chroma](https://github.com/chroma-core/chroma) with langchainjs.

## Setup

1. Run chroma inside of docker on your computer [docs](https://docs.trychroma.com/api-reference)
2. Install the chroma js client.

```bash npm2yarn
npm install -S chromadb
```

## Index and query docs

```typescript
import { Chroma } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { VectorDBQAChain } from "langchain/chains";
import { OpenAI } from "langchain";

const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
  collectionName: "goldel-escher-bach",
});

const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  returnSourceDocuments: true,
});
const response = await chain.call({
  query: "What does the doc say about Chroma?",
});
```

## Query docs from existing collection

```typescript
import { Chroma } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { OpenAI } from "langchain";
import { VectorDBQAChain } from "langchain/chains";

const vectorStore = await Chroma.fromExistingCollection(
  new OpenAIEmbeddings(),
  {
    collectionName: "goldel-escher-bach",
  }
);

const model = new OpenAI();
const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
  returnSourceDocuments: true,
});
const response = await chain.call({
  query: "What does the doc say about Chroma?",
});
```
