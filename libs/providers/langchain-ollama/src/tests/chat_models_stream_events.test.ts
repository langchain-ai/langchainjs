import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatOllama } from "../chat_models.js";

function ollamaTextChunks() {
  return [
    { message: { content: "Hello" } },
    { message: { content: " world" } },
    { message: {}, done_reason: "stop" },
  ];
}

function ollamaReasoningChunks() {
  return [
    { message: { thinking: "Let me reason..." } },
    { message: {}, done_reason: "stop" },
  ];
}

function ollamaToolChunks() {
  return [
    { message: { content: "Let me search." } },
    {
      message: {
        tool_calls: [
          {
            function: {
              name: "web_search",
              arguments: { query: "weather" },
            },
          },
        ],
      },
    },
    { message: {}, done_reason: "stop" },
  ];
}

function ollamaUsageChunks() {
  return [
    {
      message: { content: "Hi" },
      prompt_eval_count: 10,
      eval_count: 3,
    },
    { message: {}, done_reason: "stop" },
  ];
}

function mockOllama(chunks: Record<string, unknown>[]) {
  const model = new ChatOllama({
    model: "llama3",
    think: true,
    checkOrPullModel: false,
  });
  vi.spyOn(model.client, "chat").mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as never);
  return model;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatOllama.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockOllama(ollamaTextChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockOllama(ollamaReasoningChunks()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockOllama(ollamaToolChunks()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockOllama(ollamaUsageChunks()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 3,
      total_tokens: 13,
    });
  });
});
