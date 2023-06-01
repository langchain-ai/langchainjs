import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { MongoClient } from "mongodb";

export const run = async () => {
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
  const namespace = "langchain.test";

  await MongoDBAtlasVectorSearch.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new CohereEmbeddings(),
    {
      client,
      namespace,
    }
  );

  await client.close();
};
