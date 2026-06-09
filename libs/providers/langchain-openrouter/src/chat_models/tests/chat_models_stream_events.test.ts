import { describe, expect, test, vi, afterEach } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAITextOnlyChunksWithUsage,
  openAIToolCallChunks,
  sseResponseFromOpenAIChunks,
} from "@langchain/core/testing";
import { ChatOpenRouter } from "../index.js";

function mockOpenRouter(chunks: ReturnType<typeof openAITextOnlyChunks>) {
  const model = new ChatOpenRouter({
    apiKey: "fake-key",
    model: "openai/gpt-4o-mini",
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sseResponseFromOpenAIChunks(chunks)
  );
  return model;
}

function openRouterReasoningChunks(): ReturnType<typeof openAITextOnlyChunks> {
  return [
    {
      id: "gen-1",
      model: "openai/gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", reasoning: "thinking..." },
          finish_reason: null,
        },
      ],
    },
    {
      id: "gen-1",
      model: "openai/gpt-4o-mini",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
  ] as unknown as ReturnType<typeof openAITextOnlyChunks>;
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

  test("streams OpenRouter reasoning field", async () => {
    await expect(
      mockOpenRouter(openRouterReasoningChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("thinking...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockOpenRouter(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockOpenRouter(openAITextOnlyChunksWithUsage()).streamV2("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 12,
    });
  });
});
