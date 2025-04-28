import { OpenAI } from "@langchain/openai";
import { loadSummarizationChain } from "langchain/chains";
import { Document } from "@langchain/core/documents";

export const run = async () => {
  const model = new OpenAI({});
  const chain = loadSummarizationChain(model, { type: "stuff" });
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  const res = await chain.invoke({
    input_documents: docs,
  });
  console.log(res);
};
