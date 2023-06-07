import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

  await MongoDBAtlasVectorSearch.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new CohereEmbeddings(),
    { collection }
  );

  await client.close();
};
