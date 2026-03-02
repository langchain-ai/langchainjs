import { test, expect } from "vitest";
import { ChatCerebras } from "../chat_models.js";

test("constructor supports string model shorthand", () => {
  const llm = new ChatCerebras("llama-3.3-70b", {
    apiKey: "test-api-key",
    temperature: 0.2,
  });

  expect(llm.model).toBe("llama-3.3-70b");
  expect(llm.temperature).toBe(0.2);

  const llmWithParams = new ChatCerebras({
    model: "llama-3.3-70b",
    apiKey: "test-api-key",
  });

  expect(llmWithParams.model).toBe("llama-3.3-70b");
});
