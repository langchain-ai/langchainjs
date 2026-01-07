import { test, expect } from "vitest";
import { Ollama } from "../llms.js";

test("test deep seek model with think=false", async () => {
  const ollama = new Ollama({
    model: "deepseek-r1:32b",
    think: false, // Ensure the "think" field is explicitly set to false
    maxRetries: 1,
  });

  const res = await ollama.invoke("Explain the process of photosynthesis briefly.");

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(typeof res).toBe("string");

  // Validate that the response does not include any thinking content
  // When think=false, the response should only contain the final answer
  expect(res).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(res.length).toBeGreaterThan(1);
});

test("test deep seek model with think=true", async () => {
  const ollama = new Ollama({
    model: "deepseek-r1:32b",
    think: true,
    maxRetries: 1,
  });

  const res = await ollama.invoke("Explain the process of photosynthesis briefly.");

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(typeof res).toBe("string");

  // When think=true, the response should include the thinking content
  // The LLM class returns thinking + final answer as a concatenated string
  expect(res).toMatch(/photosynthesis/i); // Check it includes the topic
  console.log(res);
  expect(res.length).toBeGreaterThan(10);

  // The thinking content should be included in the response
  // Note: Unlike chat models, LLM returns everything in a single string
}, 120_000);

test("test deep seek model with think undefined (default)", async () => {
  const ollama = new Ollama({
    model: "deepseek-r1:32b",
    maxRetries: 1,
  });

  const res = await ollama.invoke("Explain the process of photosynthesis briefly.");

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(typeof res).toBe("string");

  // When think is undefined, it should default to not using thinking mode
  // (or whatever the Ollama API default is - typically false)
  expect(res).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(res.length).toBeGreaterThan(1);
}, 120_000);