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

const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
  collectionName: "goldel-escher-bach",
});

const response = await vectorStore.similaritySearch("scared", 2);
```

## Query docs from existing collection

```typescript
import { Chroma } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

const vectorStore = await Chroma.fromExistingCollection(
  new OpenAIEmbeddings(),
  {
    collectionName: "goldel-escher-bach",
  }
);

const response = await vectorStore.similaritySearch("scared", 2);
```
