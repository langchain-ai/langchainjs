import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings();
const vectorStore = new Chroma(embeddings, {
  collectionName: "test-deletion",
});

const documents = [
  {
    pageContent: `Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little
    Harmonic Labyrinth of the dreaded Majotaur?`,
    metadata: {
      speaker: "Tortoise",
    },
  },
  {
    pageContent: "Achilles: Yiikes! What is that?",
    metadata: {
      speaker: "Achilles",
    },
  },
  {
    pageContent: `Tortoise: They say-although I person never believed it myself-that an I
    Majotaur has created a tiny labyrinth sits in a pit in the middle of
    it, waiting innocent victims to get lost in its fears complexity.
    Then, when they wander and dazed into the center, he laughs and
    laughs at them-so hard, that he laughs them to death!`,
    metadata: {
      speaker: "Tortoise",
    },
  },
  {
    pageContent: "Achilles: Oh, no!",
    metadata: {
      speaker: "Achilles",
    },
  },
  {
    pageContent: "Tortoise: But it's only a myth. Courage, Achilles.",
    metadata: {
      speaker: "Tortoise",
    },
  },
];

// Also supports an additional {ids: []} parameter for upsertion
const ids = await vectorStore.addDocuments(documents);

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

// You can also pass a "filter" parameter instead
await vectorStore.delete({ ids });

const response2 = await vectorStore.similaritySearch("scared", 2);
console.log(response2);

/*
  []
*/
