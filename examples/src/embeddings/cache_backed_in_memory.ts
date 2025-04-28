import { OpenAIEmbeddings } from "@langchain/openai";
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed";
import { InMemoryStore } from "@langchain/core/stores";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { TextLoader } from "langchain/document_loaders/fs/text";

const underlyingEmbeddings = new OpenAIEmbeddings();

const inMemoryStore = new InMemoryStore();

const cacheBackedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
  underlyingEmbeddings,
  inMemoryStore,
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

// No keys logged yet since the cache is empty
for await (const key of inMemoryStore.yieldKeys()) {
  console.log(key);
}

let time = Date.now();
const vectorstore = await FaissStore.fromDocuments(
  documents,
  cacheBackedEmbeddings
);
console.log(`Initial creation time: ${Date.now() - time}ms`);
/*
  Initial creation time: 1905ms
*/

// The second time is much faster since the embeddings for the input docs have already been added to the cache
time = Date.now();
const vectorstore2 = await FaissStore.fromDocuments(
  documents,
  cacheBackedEmbeddings
);
console.log(`Cached creation time: ${Date.now() - time}ms`);
/*
  Cached creation time: 8ms
*/

// Many keys logged with hashed values
const keys = [];
for await (const key of inMemoryStore.yieldKeys()) {
  keys.push(key);
}

console.log(keys.slice(0, 5));
/*
  [
    'text-embedding-ada-002ea9b59e760e64bec6ee9097b5a06b0d91cb3ab64',
    'text-embedding-ada-0023b424f5ed1271a6f5601add17c1b58b7c992772e',
    'text-embedding-ada-002fec5d021611e1527297c5e8f485876ea82dcb111',
    'text-embedding-ada-00262f72e0c2d711c6b861714ee624b28af639fdb13',
    'text-embedding-ada-00262d58882330038a4e6e25ea69a938f4391541874'
  ]
*/
