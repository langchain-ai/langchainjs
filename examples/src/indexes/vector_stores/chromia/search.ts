import { Chromia } from "@langchain/community/vectorstores/chromia";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient, } from "postchain-client";

const embeddings = new OpenAIEmbeddings();

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

const vectorStore = new Chromia(embeddings, {
  client: postchainClient,
  numDimensions: embeddings.dimensions,
});

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
