import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatDeepSeek } from "../chat_models.js";

class MockStreamChatDeepSeek extends ChatDeepSeek {
  constructor(
    private readonly chunks: ReturnType<typeof openAITextOnlyChunks>
  ) {
    super({ apiKey: "fake-key", model: "deepseek-chat", streaming: true });
  }

  override async completionWithRetry() {
    const chunks = this.chunks;
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  }
}

describe("ChatDeepSeek.streamV2", () => {
  test("streams text", async () => {
    await expect(
      new MockStreamChatDeepSeek(openAITextOnlyChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatDeepSeek(openAIReasoningTextChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatDeepSeek(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
