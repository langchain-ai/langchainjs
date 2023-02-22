import { OpenAI } from "langchain/llms";
import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

export const run = async () => {
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  const model = new OpenAI({ temperature: 0 });
  /* Split the text into chunks. */
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = textSplitter.createDocuments([text]);
  /** Call the summarization chain. */
  const chain = loadSummarizationChain(model);
  const res = await chain.call({
    input_documents: docs,
  });
  console.log({ res });
};
