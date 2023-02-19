import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai";
import { loadQAChain } from "../load";
import { Document } from "../../../document";

test("Test loadQAChain", async () => {
  const model = new OpenAI({});
  const chain = loadQAChain(model);
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});
