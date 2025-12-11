import { test, expect } from "vitest";
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

  // Ensure reasoning is not present when think is disabled
  expect(res.additional_kwargs?.reasoning_content).toBeUndefined();

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

  // Ensure reasoning content is captured separately when think is enabled
  const reasoning = res.additional_kwargs?.reasoning_content as
    | string
    | undefined;
  expect(typeof reasoning === "string" ? reasoning.length : 0).toBeGreaterThan(
    0
  );
  // And ensure content does not contain raw <think> tags
  expect(responseContent).not.toMatch(/<think>.*?<\/think>/is);
}, 120_000);
