import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { Document } from "../../document.js";
import {
  loadQAMapReduceChain,
  loadQARefineChain,
} from "../question_answering/load.js";
import { createStuffDocumentsChain } from "../combine_documents/stuff.js";

test("Test StuffDocumentsChain", async () => {
  const llm = new OpenAI({ modelName: "text-ada-001" });
  const prompt = PromptTemplate.fromTemplate("Print {context}");
  const chain = await createStuffDocumentsChain({ llm, prompt });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.invoke({ context: docs });
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
  const res = await chain.invoke({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  console.log({ res });
});
