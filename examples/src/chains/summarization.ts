import { OpenAI } from "langchain/llms";
import { loadSummarizationChain } from "langchain/chains";
import { Document } from "langchain/document";

export const run = async () => {
  const model = new OpenAI({});
  const chain = loadSummarizationChain(model, { type: "stuff" });
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  const res = await chain.call({
    input_documents: docs,
  });
  console.log(res);
};
