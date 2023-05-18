import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import {
  initializeQAMapReduceChain,
  initializeQARefineChain,
  initializeQAStuffChain,
} from "../initialize.js";
import { Document } from "../../../document.js";

test("Test initializeQAStuffChain", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQAStuffChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test initializeQAMapReduceChain", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQAMapReduceChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test initializeQARefineChain", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQARefineChain(model);
  const docs = [
    new Document({ pageContent: "Harrison went to Harvard." }),
    new Document({ pageContent: "Ankush went to Princeton." }),
  ];
  const res = await chain.call({
    input_documents: docs,
    question: "Where did Harrison go to college?",
  });
  console.log({ res });
});
