import { describe, expect, test } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAIToolCallChunks,
} from "@langchain/core/testing";
import { OpenAIClient } from "@langchain/openai";
import { ChatDeepSeek } from "../chat_models.js";

type RawChunk = OpenAIClient.Chat.Completions.ChatCompletionChunk;

function toDeepSeekChunks(
  chunks: ReturnType<typeof openAITextOnlyChunks>
): RawChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    id: chunk.id ?? "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: chunk.model ?? "deepseek-chat",
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

class MockStreamChatDeepSeek extends ChatDeepSeek {
  constructor(private readonly chunks: RawChunk[]) {
    super({ apiKey: "fake-key", model: "deepseek-chat", streaming: true });
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

describe("ChatDeepSeek.streamV2", () => {
  test("streams text", async () => {
    await expect(
      new MockStreamChatDeepSeek(
        toDeepSeekChunks(openAITextOnlyChunks())
      ).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      new MockStreamChatDeepSeek(
        toDeepSeekChunks(openAIReasoningTextChunks())
      ).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      new MockStreamChatDeepSeek(
        toDeepSeekChunks(openAIToolCallChunks())
      ).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
