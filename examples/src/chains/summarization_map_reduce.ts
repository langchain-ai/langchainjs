import { OpenAI } from "langchain/llms";
import { loadSummarizationChain } from "langchain/chains";
import { Document } from "langchain/document";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const chain = loadSummarizationChain(model, { type: "map_reduce" });
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  const res = await chain.call({
    input_documents: docs,
  });
  console.log({ res });
};
