import { test, expect } from "vitest";
import { convertOllamaMessagesToLangChain } from "../utils.js";

test("convertOllamaMessagesToLangChain separates thinking into reasoning_content", () => {
  const msg = {
    role: "assistant",
    content: "Hello! How can I help?",
    thinking: "We should respond politely.",
  } as unknown as Parameters<typeof convertOllamaMessagesToLangChain>[0];

  const chunk = convertOllamaMessagesToLangChain(msg);

  expect(typeof chunk.content === "string" ? chunk.content : "").toBe(
    "Hello! How can I help?"
  );
  expect(chunk.additional_kwargs?.reasoning_content).toBe(
    "We should respond politely."
  );
});
