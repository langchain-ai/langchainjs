// If you want to import the browser version, use the following line instead:
// import { CloseVectorWeb } from "@langchain/community/vectorstores/closevector/web";
import { CloseVectorNode } from "@langchain/community/vectorstores/closevector/node";
import { OpenAIEmbeddings } from "@langchain/openai";

export const run = async () => {
  // If you want to import the browser version, use the following line instead:
  // const vectorStore = await CloseVectorWeb.fromTexts(
  const vectorStore = await CloseVectorNode.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
};
