import { test } from "@jest/globals";
import { OpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { loadSummarizationChain } from "../load.js";

test("Test loadSummzationChain stuff", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadSummarizationChain(model, { type: "stuff" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  // console.log({ res });
});

test("Test loadSummarizationChain map_reduce", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadSummarizationChain(model, { type: "map_reduce" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  // console.log({ res });
});

test("Test loadSummarizationChain refine", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadSummarizationChain(model, { type: "refine" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  // console.log({ res });
});
