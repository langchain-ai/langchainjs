/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@jest/globals";
import { ChatDeepSeek } from "../chat_models.js";

test("Can send deepseek-reasoner requests", async () => {
  const llm = new ChatDeepSeek({
    model: "deepseek-reasoner",
  });
  const input = `Translate "I love programming" into French.`;
  // Models also accept a list of chat messages or a formatted prompt
  const result = await llm.invoke(input);
  expect(
    (result.additional_kwargs.reasoning_content as any).length
  ).toBeGreaterThan(10);
});
