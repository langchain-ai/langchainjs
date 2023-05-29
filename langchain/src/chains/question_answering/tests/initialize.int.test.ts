import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";
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

test("Test initializeQAStuffChain with a custom prefix", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQAStuffChain(model, {
    prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
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

test("Test initializeQAStuffChain with a custom prefix and a chat model", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const chain = await initializeQAStuffChain(model, {
    prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
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

test("Test initializeQAMapReduceChain with a custom combine chain prefix", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQAMapReduceChain(model, {
    combineChainOptions: {
      prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
    }
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

test("Test initializeQAMapReduceChain with a custom combine chain prefix and a chat model", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const chain = await initializeQAMapReduceChain(model, {
    combineChainOptions: {
      prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
    }
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

test("Test initializeQARefineChain with a custom refine chain prefix", async () => {
  const model = new OpenAI({ modelName: "text-davinci-003" });
  const chain = await initializeQARefineChain(model, {
    refineChainOptions: {
      prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
    }
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

test("Test initializeQARefineChain with a custom refine chain prefix and a chat model", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const chain = await initializeQARefineChain(model, {
    refineChainOptions: {
      prefix: `You must be verbose, and output your answer like a pirate. Use plenty of args!`,
    }
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