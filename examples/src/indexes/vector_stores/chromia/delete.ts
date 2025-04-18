import { Chromia } from "@langchain/community/vectorstores/chromia";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient, } from "postchain-client";


const nodeUrlPool = process.env.NODE_URL_POOL;
if (!nodeUrlPool) throw new Error(`Expected env var NODE_URL_POOL`);

const merkleHashVersion = process.env.MERKLE_HASH_VERSION;
if (!merkleHashVersion) throw new Error(`Expected env var MERKLE_HASH_VERSION`);

const directoryChainRid = process.env.DIRECTORY_CHAIN_RID;
if (!directoryChainRid) throw new Error(`Expected env var DIRECTORY_CHAIN_RID`);

const blockchainRid = process.env.BLOCKCHAIN_RID;
if (!blockchainRid) throw new Error(`Expected env var BLOCKCHAIN_RID`);

const postchainClient = await createClient({
  nodeUrlPool: nodeUrlPool,
  merkleHashVersion: 1,
  directoryChainRid: directoryChainRid,
  blockchainRid: blockchainRid,
})


const embeddings = new OpenAIEmbeddings();
const vectorStore = new Chromia(new OpenAIEmbeddings(), {
  client: postchainClient,
  numDimensions: new OpenAIEmbeddings().dimensions,
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
