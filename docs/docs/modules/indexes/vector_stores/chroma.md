# Chroma

Chroma is an open-source Apache 2.0 embedding database.

Use [chroma](https://github.com/chroma-core/chroma) with langchainjs.

## Setup

1. Run chroma inside of docker on your computer [docs](https://docs.trychroma.com/api-reference)
2. Install the chroma js client. `npm install -S chromadb`

## Usage

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
