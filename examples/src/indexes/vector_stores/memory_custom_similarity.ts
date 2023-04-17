import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { similarity } from "ml-distance";

export const run = async () => {
  const vectorStore = await MemoryVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    { similarity: similarity.pearson }
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
};
