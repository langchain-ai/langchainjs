import { test, expect } from "vitest";
import { ChatIOIntelligence } from "../chat_models.js";

test("invoke", async () => {
  const llm = new ChatIOIntelligence({
    model: "meta-llama/Llama-3.3-70B-Instruct",
  });
  const result = await llm.invoke("What is 2 + 2?");
  expect(result.content.length).toBeGreaterThan(0);
});

test("stream", async () => {
  const llm = new ChatIOIntelligence({
    model: "meta-llama/Llama-3.3-70B-Instruct",
  });
  const stream = await llm.stream("What is 2 + 2?");
  let tokens = "";
  for await (const chunk of stream) {
    tokens += chunk.content;
  }
  expect(tokens.length).toBeGreaterThan(0);
});
