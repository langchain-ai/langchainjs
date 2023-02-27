# Vectorstores

A vectorstore is a particular type of database optimized for storing documents, embeddings, and then allowing for fetching of the most relevant documents for a particular query.

## HNSWLib

HNSWLib is an in-memory vectorstore.

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

## Chroma embedding database

Chroma is an open-source Apache 2.0 embedding database.

Use [chroma](https://github.com/chroma-core/chroma) with langchainjs.

1. Run chroma inside of docker on your computer [docs](https://docs.trychroma.com/api-reference)
2. Install the chroma js client. `npm install -S chromadb`

```typescript
import { Chroma } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

// text sample from Godel, Escher, Bach
const vectorStore = await Chroma.fromTexts(
  [
    "Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little\
        Harmonic Labyrinth of the dreaded Majotaur?",
    "Achilles: Yiikes! What is that?",
    "Tortoise: They say-although I person never believed it myself-that an I\
        Majotaur has created a tiny labyrinth sits in a pit in the middle of\
        it, waiting innocent victims to get lost in its fears complexity.\
        Then, when they wander and dazed into the center, he laughs and\
        laughs at them-so hard, that he laughs them to death!",
    "Achilles: Oh, no!",
    "Tortoise: But it's only a myth. Courage, Achilles.",
  ],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings(),
  "goldel-escher-bach"
);
const resultOne = await vectorStore.similaritySearch("scared", 2);
console.log(resultOne); // -> 'Achilles: Yiikes! What is that?'
```

## Pinecone vectorstore

Langchain.js accepts [@pinecone-database/pinecone](https://docs.pinecone.io/docs/node-client) as the client for Pinecone vectorstore. Install the library with `npm install -S @pinecone-database/pinecone`.

Index docs

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

Query docs

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
