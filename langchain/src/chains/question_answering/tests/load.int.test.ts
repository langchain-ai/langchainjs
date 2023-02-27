import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import { loadQAChain } from "../load.js";
import { Document } from "../../../document.js";

test("Test loadQAChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadQAChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadQAChain map_reduce", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadQAChain(model, { type: "map_reduce" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});
