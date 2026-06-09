import { describe, expect, test, vi, afterEach } from "vitest";
import {
  asAsyncIterable,
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatPerplexity } from "../chat_models.js";

function mockPerplexity(chunks: ReturnType<typeof openAITextOnlyChunks>) {
  const model = new ChatPerplexity({
    apiKey: "fake-key",
    model: "sonar",
    streaming: true,
  });
  vi.spyOn(model.client.chat.completions, "create").mockResolvedValue(
    asAsyncIterable(chunks) as never
  );
  return model;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatPerplexity.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockPerplexity(openAITextOnlyChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockPerplexity(openAIReasoningTextChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockPerplexity(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
