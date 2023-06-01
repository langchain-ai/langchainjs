import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
  const namespace = "langchain.test";

  const vectorStore = new MongoDBAtlasVectorSearch(
    new CohereEmbeddings(),
    {
      client,
      namespace,
    }
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);

  await client.close();
};
