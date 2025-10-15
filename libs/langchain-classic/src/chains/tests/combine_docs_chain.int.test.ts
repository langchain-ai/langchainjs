import { test } from "vitest";
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import {
  loadQAMapReduceChain,
  loadQARefineChain,
} from "../question_answering/load.js";
import { createStuffDocumentsChain } from "../combine_documents/stuff.js";

test("Test StuffDocumentsChain", async () => {
  const llm = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = PromptTemplate.fromTemplate("Print {context}");
  const chain = await createStuffDocumentsChain({ llm, prompt });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.invoke({ context: docs });
  // console.log({ res });
});

test("Test MapReduceDocumentsChain with QA chain", async () => {
  const model = new OpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const chain = loadQAMapReduceChain(model);
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  // console.log({ res });
});

test("Test RefineDocumentsChain with QA chain", async () => {
  const model = new OpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const chain = loadQARefineChain(model);
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.invoke({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  // console.log({ res });
});
