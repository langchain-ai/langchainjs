import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import {
  loadQAMapReduceChain,
  loadQARefineChain,
  loadQAStuffChain,
} from "../load.js";
import { Document } from "../../../document.js";

test("Test loadQAStuffChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadQAStuffChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadQAStuffChain with a chat model and a custom prefix", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const chain = loadQAStuffChain(model, {
    prefix: `Be verbose, and output your answer like a pirate. Use plenty of args!`,
  });
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

test("Test loadQAMapReduceChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadQAMapReduceChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadQARefineChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadQARefineChain(model);
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
