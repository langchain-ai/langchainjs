import { MongoVectorStore } from "langchain/vectorstores";
import { CohereEmbeddings } from "langchain/embeddings";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGO_URI || "");

  const collection = client.db("langchain").collection("test");

  const vectorStore = new MongoVectorStore(new CohereEmbeddings(), {
    client,
    collection,
    // indexName: "default", // make sure that this matches the index name in atlas if not using "default"
  });

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);

  console.log(resultOne);

  // remember to close the client
  await client.close();
};
