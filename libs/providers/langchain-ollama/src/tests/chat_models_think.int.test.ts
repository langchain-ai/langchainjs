import { test, expect } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOllama } from "../chat_models.js";

test("test deep seek model with think=false", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    think: false, // Ensure the "think" field is explicitly set to false
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "Explain the process of photosynthesis briefly.",
    }),
  ]);

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();

  const responseContent = res.content;

  // Validate that the response does not include any <think>...</think> blocks
  // s means allow . to match new line character
  expect(responseContent).not.toMatch(/<think>.*?<\/think>/is);

  // Ensure the response is concise and directly answers the question
  expect(responseContent).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(responseContent.length).toBeGreaterThan(1);
});

test("test deep seek model with think=true (default)", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "Explain the process of photosynthesis briefly.",
    }),
  ]);

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();

  const responseContent = res.content;

  // Ensure the response is concise and directly answers the question
  expect(responseContent).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(responseContent.length).toBeGreaterThan(1);
});
