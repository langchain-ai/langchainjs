import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "@pinecone-database/pinecone";

export const run = async () => {
  const client = new PineconeClient();
  await client.init({
    environment: "us-west1-gcp",
    apiKey: "apiKey",
  });

  const index = client.Index("my-index");
  const vectorStore = await PineconeStore.fromTexts(
    index,
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "Hello world",
    2
  );
  console.dir(resultOne, { depth: null });
};
