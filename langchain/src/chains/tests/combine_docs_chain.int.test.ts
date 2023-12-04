import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { StuffDocumentsChain } from "../combine_docs_chain.js";
import { Document } from "../../document.js";
import {
  loadQAMapReduceChain,
  loadQARefineChain,
} from "../question_answering/load.js";

test("Test StuffDocumentsChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const llmChain = new LLMChain({ prompt, llm: model });
  const chain = new StuffDocumentsChain({
    llmChain,
    documentVariableName: "foo",
  });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs });
  console.log({ res });
});

test("Test MapReduceDocumentsChain with QA chain", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-ada-001" });
  const chain = loadQAMapReduceChain(model);
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  const res = await chain.call({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  console.log({ res });
});

test("Test RefineDocumentsChain with QA chain", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-ada-001" });
  const chain = loadQARefineChain(model);
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  const res = await chain.call({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  console.log({ res });
});
