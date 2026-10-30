import { describe, expect, test, vi } from "vitest";
import {
  asAsyncIterable,
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatGroq } from "../chat_models.js";

function openAITextWithUsage() {
  const chunks = openAITextOnlyChunks();
  const last = chunks[chunks.length - 1]!;
  chunks[chunks.length - 1] = {
    ...last,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 2,
      total_tokens: 12,
    },
  };
  return chunks;
}

function mockGroq(chunks: ReturnType<typeof openAITextOnlyChunks>) {
  const model = new ChatGroq({
    apiKey: "fake-key",
    model: "llama-3.1-8b-instant",
    streaming: true,
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue(
    asAsyncIterable(chunks) as never
  );
  return model;
}

describe("ChatGroq.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockGroq(openAITextOnlyChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockGroq(openAIReasoningTextChunks()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockGroq(openAIToolCallChunks()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockGroq(openAITextWithUsage()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 12,
    });
  });

  test("assembles output", async () => {
    await expect(
      mockGroq(openAITextWithUsage()).streamEvents("Hello")
    ).toHaveStreamOutput({
      id: "chatcmpl-text",
      text: "Hello world",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
    });
  });
});
