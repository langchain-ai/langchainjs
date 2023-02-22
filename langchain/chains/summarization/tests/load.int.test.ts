import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai";
import { loadSummarizationChain } from "../load";
import { Document } from "../../../document";

test("Test loadSummzationChain", async () => {
  const model = new OpenAI({});
  const chain = loadSummarizationChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadQAChain map_reduce", async () => {
  const model = new OpenAI({});
  const chain = loadSummarizationChain(model, { type: "map_reduce" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});
