import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

  const vectorStore = new MongoDBAtlasVectorSearch(new CohereEmbeddings(), {
    collection,
  });

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);

  await client.close();
};
