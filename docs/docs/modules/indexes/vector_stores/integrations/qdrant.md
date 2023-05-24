---
sidebar_class_name: node-only
---

# Qdrant

[Qdrant](https://qdrant.tech/) is a vector similarity search engine. It provides a production-ready service with a convenient API to store, search, and manage points - vectors with an additional payload.

:::tip Compatibility
Only available on Node.js.
:::

## Setup

1. Run Qdrant instance with Docker on your computer [docs](https://qdrant.tech/documentation/install/)
2. Install the Qdrant Node.js SDK.

   ```bash npm2yarn
   npm install -S @qdrant/js-client-rest
   ```

3. Setup Env variables for Qdrant before running the code

   3.1 OpenAI

   ```bash
   export OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
   export QDRANT_URL=YOUR_QDRANT_URL_HERE # for example http://localhost:6333
   ```

   3.2 Azure OpenAI

   ```bash
   export AZURE_OPENAI_API_KEY=YOUR_AZURE_OPENAI_API_KEY_HERE
   export AZURE_OPENAI_API_INSTANCE_NAME=YOUR_AZURE_OPENAI_INSTANCE_NAME_HERE
   export AZURE_OPENAI_API_DEPLOYMENT_NAME=YOUR_AZURE_OPENAI_DEPLOYMENT_NAME_HERE
   export AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME=YOUR_AZURE_OPENAI_COMPLETIONS_DEPLOYMENT_NAME_HERE
   export AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME=YOUR_AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME_HERE
   export AZURE_OPENAI_API_VERSION=YOUR_AZURE_OPENAI_API_VERSION_HERE
   export QDRANT_URL=YOUR_QDRANT_URL_HERE # for example http://localhost:6333
   ```

## Index and query docs

```typescript
import { Qdrant } from "langchain/vectorstores/qdrant";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

// text sample from Godel, Escher, Bach
const vectorStore = await Qdrant.fromTexts(
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
  [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new OpenAIEmbeddings(),
  {
    url: process.env.QDRANT_URL,
    collectionName: "goldel_escher_bach",
  }
);

// or alternatively from docs
const vectorStore = await Qdrant.fromDocuments(docs, new OpenAIEmbeddings(), {
  url: process.env.QDRANT_URL,
  collectionName: "goldel_escher_bach",
});

const response = await vectorStore.similaritySearch("scared", 2);
```

## Query docs from existing collection

```typescript
import { Qdrant } from "langchain/vectorstores/qdrant";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await Qdrant.fromExistingCollection(
  new OpenAIEmbeddings(),
  {
    url: process.env.QDRANT_URL,
    collectionName: "goldel_escher_bach",
  }
);

const response = await vectorStore.similaritySearch("scared", 2);
```

## Use Qdrant in ConversationalRetrievalQAChain

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { Qdrant } from "langchain/vectorstores/qdrant";
import { OpenAI } from "@tant/langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ConversationalRetrievalQAChain } from "@tant/langchain/chains";

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
});

const vectorStore = new Qdrant(new OpenAIEmbeddings(), {
  client: qdrantClient,
  collectionName: "qa_documents",
});

const model = new OpenAI();

const chain = ConversationalRetrievalQAChain.fromLLM(
  model,
  vectorstore.asRetriever(),
  {
    qaTemplate: QA_PROMPT,
    questionGeneratorTemplate: CONDENSE_PROMPT,
    returnSourceDocuments: true,
  }
);

const response = await chain.call({
  question: "",
  chat_history: [],
});
```
