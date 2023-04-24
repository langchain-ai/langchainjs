import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

// text sample from Godel, Escher, Bach
const vectorStore = await Chroma.fromTexts(
  [
    `Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little
        Harmonic Labyrinth of the dreaded Majotaur?`,
    "Achilles: Yiikes! What is that?",
    `Tortoise: They say-although I person never believed it myself-that an I
        Majotaur has created a tiny labyrinth sits in a pit in the middle of
        it, waiting innocent victims to get lost in its fears complexity.
        Then, when they wander and dazed into the center, he laughs and
        laughs at them-so hard, that he laughs them to death!`,
    "Achilles: Oh, no!",
    "Tortoise: But it's only a myth. Courage, Achilles.",
  ],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings(),
  {
    collectionName: "godel-escher-bach",
  }
);

const response = await vectorStore.similaritySearch("scared", 2);

console.log(response);
/*
[
  Document { pageContent: 'Achilles: Oh, no!', metadata: {} },
  Document {
    pageContent: 'Achilles: Yiikes! What is that?',
    metadata: { id: 1 }
  }
]
*/
