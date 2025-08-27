import { test } from "vitest";
import { OpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import {
  loadQAMapReduceChain,
  loadQARefineChain,
  loadQAStuffChain,
} from "../load.js";

test("Test loadQAStuffChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadQAStuffChain(model);
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

test("Test loadQAMapReduceChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadQAMapReduceChain(model);
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

test("Test loadQARefineChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = loadQARefineChain(model);
  const docs = [
    new Document({ pageContent: "Harrison went to Harvard." }),
    new Document({ pageContent: "Ankush went to Princeton." }),
  ];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    input_documents: docs,
    question: "Where did Harrison go to college?",
  });
  // console.log({ res });
});
