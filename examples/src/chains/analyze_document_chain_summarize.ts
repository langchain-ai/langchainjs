import { OpenAI } from "langchain/llms";
import { loadSummarizationChain, AnalyzeDocumentChain } from "langchain/chains";
import * as fs from "fs";

export const run = async () => {
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  const model = new OpenAI({ temperature: 0 });
  /** Call the summarization chain. */
  const combineDocsChain = loadSummarizationChain(model);
  const chain = new AnalyzeDocumentChain({
    combineDocumentsChain: combineDocsChain,
  });
  const res = await chain.call({
    input_document: text,
  });
  console.log({ res });
};
