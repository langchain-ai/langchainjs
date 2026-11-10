import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { OpenAIClient } from "@langchain/openai";
import { ChatTogetherAI } from "../chat_models.js";

type RawChunk = OpenAIClient.Chat.Completions.ChatCompletionChunk;

function toTogetherAIChunks(
  chunks: ReturnType<typeof openAITextOnlyChunks>
): RawChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    id: chunk.id ?? "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: chunk.model ?? "meta-llama/Llama-3-8b-chat-hf",
    service_tier: null,
    system_fingerprint: chunk.system_fingerprint ?? undefined,
    usage: chunk.usage
      ? {
          prompt_tokens: chunk.usage.prompt_tokens ?? 0,
          completion_tokens: chunk.usage.completion_tokens ?? 0,
          total_tokens: chunk.usage.total_tokens ?? 0,
        }
      : chunk.usage,
    choices: (chunk.choices ?? []).map((choice) => ({
      ...choice,
      delta: choice.delta ?? {},
    })) as RawChunk["choices"],
  }));
}

class MockStreamChatTogetherAI extends ChatTogetherAI {
  constructor(private readonly chunks: RawChunk[]) {
    super({
      apiKey: "fake-key",
      model: "meta-llama/Llama-3-8b-chat-hf",
      streaming: true,
    });
  }

  override async completionWithRetry(
    _request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
  ): Promise<AsyncIterable<RawChunk>>;

  override async completionWithRetry(
    _request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  override async completionWithRetry(
    _request: OpenAIClient.Chat.ChatCompletionCreateParams
  ): Promise<
    AsyncIterable<RawChunk> | OpenAIClient.Chat.Completions.ChatCompletion
  > {
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
      new MockStreamChatTogetherAI(
        toTogetherAIChunks(openAITextOnlyChunks())
      ).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatTogetherAI(
        toTogetherAIChunks(openAIReasoningTextChunks())
      ).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatTogetherAI(
        toTogetherAIChunks(openAIToolCallChunks())
      ).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
