import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import { loadQAMapReduceChain, loadQAStuffChain } from "../load.js";
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
