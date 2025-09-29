import { Redis } from "ioredis";

import { OpenAIEmbeddings } from "@langchain/openai";
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { RedisByteStore } from "@langchain/community/storage/ioredis";
import { TextLoader } from "langchain/document_loaders/fs/text";

const underlyingEmbeddings = new OpenAIEmbeddings();

// Requires a Redis instance running at http://localhost:6379.
// See https://github.com/redis/ioredis for full config options.
const redisClient = new Redis();
const redisStore = new RedisByteStore({
  client: redisClient,
});

const cacheBackedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
  underlyingEmbeddings,
  redisStore,
  {
    namespace: underlyingEmbeddings.model,
  }
);

const loader = new TextLoader("./state_of_the_union.txt");
const rawDocuments = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
});
const documents = await splitter.splitDocuments(rawDocuments);

let time = Date.now();
const vectorstore = await FaissStore.fromDocuments(
  documents,
  cacheBackedEmbeddings
);
console.log(`Initial creation time: ${Date.now() - time}ms`);
/*
  Initial creation time: 1808ms
*/

// The second time is much faster since the embeddings for the input docs have already been added to the cache
time = Date.now();
const vectorstore2 = await FaissStore.fromDocuments(
  documents,
  cacheBackedEmbeddings
);
console.log(`Cached creation time: ${Date.now() - time}ms`);
/*
  Cached creation time: 33ms
*/

// Many keys logged with hashed values
const keys = [];
for await (const key of redisStore.yieldKeys()) {
  keys.push(key);
}

console.log(keys.slice(0, 5));
/*
  [
    'text-embedding-ada-002fa9ac80e1bf226b7b4dfc03ea743289a65a727b2',
    'text-embedding-ada-0027dbf9c4b36e12fe1768300f145f4640342daaf22',
    'text-embedding-ada-002ea9b59e760e64bec6ee9097b5a06b0d91cb3ab64',
    'text-embedding-ada-002fec5d021611e1527297c5e8f485876ea82dcb111',
    'text-embedding-ada-002c00f818c345da13fed9f2697b4b689338143c8c7'
  ]
*/
