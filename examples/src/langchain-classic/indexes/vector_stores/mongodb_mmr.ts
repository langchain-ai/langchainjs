import {
  MongoDBAtlasVectorSearch,
  type MongoDBAtlasVectorSearchLibArgs,
} from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
const namespace = "langchain.test";
const [dbName, collectionName] = namespace.split(".");
const collection = client.db(dbName).collection(collectionName);

const vectorStore = new MongoDBAtlasVectorSearch(
  // Use OpenAI embeddings here because the Cohere integration is no longer
  // managed in this repository.
  new OpenAIEmbeddings(),
  {
    collection,
    indexName: "default", // The name of the Atlas search index. Defaults to "default"
    textKey: "text", // The name of the collection field containing the raw content. Defaults to "text"
    embeddingKey: "embedding", // The name of the collection field containing the embedded text. Defaults to "embedding"
  } as unknown as MongoDBAtlasVectorSearchLibArgs
);

const resultOne = await vectorStore.maxMarginalRelevanceSearch("Hello world", {
  k: 4,
  fetchK: 20, // The number of documents to return on initial fetch
});
console.log(resultOne);

// Using MMR in a vector store retriever

const retriever = await vectorStore.asRetriever({
  searchType: "mmr",
  searchKwargs: {
    fetchK: 20,
    lambda: 0.1,
  },
});

const retrieverOutput = await retriever.invoke("Hello world");

console.log(retrieverOutput);

await client.close();
