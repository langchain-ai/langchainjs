import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatFireworks } from "../chat_models.js";

class MockStreamChatFireworks extends ChatFireworks {
  constructor(
    private readonly chunks: ReturnType<typeof openAITextOnlyChunks>
  ) {
    super({
      apiKey: "fake-key",
      model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
      streaming: true,
    });
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

describe("ChatFireworks.streamV2", () => {
  test("streams text", async () => {
    await expect(
      new MockStreamChatFireworks(openAITextOnlyChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatFireworks(openAIReasoningTextChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatFireworks(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
