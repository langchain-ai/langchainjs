import { MongoVectorStore } from "langchain/vectorstores/mongo";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGO_URI || "");

  const collection = client.db("langchain").collection("test");

  await MongoVectorStore.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new CohereEmbeddings(),
    {
      client,
      collection,
      // indexName: "default", // make sure that this matches the index name in atlas if not using "default"
    }
  );

  // remember to close the client
  await client.close();
};
