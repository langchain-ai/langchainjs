import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "@pinecone-database/pinecone";

export const run = async () => {
  const client = new PineconeClient();

  if (
    !process.env.PINECONE_ENVIRONMENT ||
    !process.env.PINECONE_API_KEY ||
    !process.env.PINECONE_INDEX
  ) {
    throw new Error(
      "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
    );
  }

  await client.init({
    environment: process.env.PINECONE_ENVIRONMENT,
    apiKey: process.env.PINECONE_API_KEY,
  });

  const vectorStore = await PineconeStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    {
      pineconeIndex: client.Index(process.env.PINECONE_INDEX),
    }
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "Hello world",
    2
  );
  console.dir(resultOne, { depth: null });
};
