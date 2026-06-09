import { describe, expect, test, vi, afterEach } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
  sseResponseFromOpenAIChunks,
} from "@langchain/core/testing";
import { ChatOpenRouter } from "../index.js";

function mockOpenRouter(chunks: ReturnType<typeof openAITextOnlyChunks>) {
  const model = new ChatOpenRouter({
    apiKey: "fake-key",
    model: "openai/gpt-4o-mini",
    streaming: true,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sseResponseFromOpenAIChunks(chunks)
  );
  return model;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatOpenRouter.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockOpenRouter(openAITextOnlyChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockOpenRouter(openAIReasoningTextChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockOpenRouter(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
