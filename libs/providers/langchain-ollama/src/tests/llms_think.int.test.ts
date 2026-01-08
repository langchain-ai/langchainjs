import { test, expect } from "vitest";
import { Ollama } from "../llms.js";

test("test deep seek model with think=true vs think=false vs think=undefined", async () => {
  const prompt = "Explain the process of photosynthesis briefly.";

  const ollamaWithoutThinking = new Ollama({
    model: "deepseek-r1:32b",
    think: false,
    maxRetries: 1,
  });

  const resWithoutThinking = await ollamaWithoutThinking.invoke(prompt);

  const ollamaWithThinking = new Ollama({
    model: "deepseek-r1:32b",
    think: true,
    maxRetries: 1,
  });

  const resWithThinking = await ollamaWithThinking.invoke(prompt);

  const ollamaDefaultThinking = new Ollama({
    model: "deepseek-r1:32b",
    maxRetries: 1,
  });

  const resDefaultThinking = await ollamaDefaultThinking.invoke(prompt);

  // Both responses should be defined
  expect(resWithoutThinking).toBeDefined();
  expect(typeof resWithoutThinking).toBe("string");
  expect(resWithThinking).toBeDefined();
  expect(typeof resWithThinking).toBe("string");
  expect(resDefaultThinking).toBeDefined();
  expect(typeof resDefaultThinking).toBe("string");

  // Both should contain relevant content
  expect(resWithoutThinking).toMatch(/photosynthesis/i);
  expect(resWithThinking).toMatch(/photosynthesis/i);
  expect(resDefaultThinking).toMatch(/photosynthesis/i);

  // The response with thinking should be significantly longer
  // because it includes the reasoning process before the final answer
  expect(resWithThinking.length).toBeGreaterThan(
    resWithoutThinking.length * 1.5
  );
  expect(resDefaultThinking.length).toBeGreaterThan(
    resWithoutThinking.length * 1.5
  );

  // The responses with thinking enabled should be similar in length
  expect(
    Math.abs(resWithThinking.length - resDefaultThinking.length)
  ).toBeLessThan(100);
}, 120_000);
