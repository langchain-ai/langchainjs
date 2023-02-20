import { PineconeStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeClient } from "pinecone-client";

export const run = async () => {
  const client = new PineconeClient({});

  const vectorStore = await PineconeStore.fromTexts(
    client,
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
