import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatXAI } from "../completions.js";

class MockStreamChatXAI extends ChatXAI {
  constructor(
    private readonly chunks: ReturnType<typeof openAITextOnlyChunks>
  ) {
    super({ apiKey: "fake-key", model: "grok-3", streaming: true });
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

describe("ChatXAI.streamV2", () => {
  test("streams text", async () => {
    await expect(
      new MockStreamChatXAI(openAITextOnlyChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatXAI(openAIReasoningTextChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatXAI(openAIToolCallChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
