import { Milvus } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

export const run = async () => {
  const vectorStore = await Milvus.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
};
