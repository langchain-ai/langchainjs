import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";

export const run = async () => {
  // Create an initial vector store
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  // Create another vector store from texts
  const vectorStore2 = await FaissStore.fromTexts(
    ["Some text"],
    [{ id: 1 }],
    new OpenAIEmbeddings()
  );

  // merge the first vector store into vectorStore2
  await vectorStore2.mergeFrom(vectorStore);

  const resultOne = await vectorStore2.similaritySearch("hello world", 1);
  console.log(resultOne);

  // You can also create a new vector store from another FaissStore index
  const vectorStore3 = await FaissStore.fromIndex(
    vectorStore2,
    new OpenAIEmbeddings()
  );
  const resultTwo = await vectorStore3.similaritySearch("Bye bye", 1);
  console.log(resultTwo);
};
