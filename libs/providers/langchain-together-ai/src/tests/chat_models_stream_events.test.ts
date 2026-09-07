import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { ChatTogetherAI } from "../chat_models.js";

class MockStreamChatTogetherAI extends ChatTogetherAI {
  constructor(
    private readonly chunks: ReturnType<typeof openAITextOnlyChunks>
  ) {
    super({
      apiKey: "fake-key",
      model: "meta-llama/Llama-3-8b-chat-hf",
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

describe("ChatTogetherAI.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      new MockStreamChatTogetherAI(openAITextOnlyChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatTogetherAI(openAIReasoningTextChunks()).streamEvents(
        "Hello"
      )
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatTogetherAI(openAIToolCallChunks()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
