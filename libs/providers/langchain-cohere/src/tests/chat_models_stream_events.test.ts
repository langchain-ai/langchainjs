import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatCohere, type ChatCohereCallOptions } from "../chat_models.js";

function cohereTextStream() {
  return [
    { eventType: "text-generation", text: "Hello" },
    { eventType: "text-generation", text: " world" },
    { eventType: "stream-end", response: {} },
  ];
}

function cohereToolStream() {
  return [
    { eventType: "text-generation", text: "Let me search." },
    {
      eventType: "stream-end",
      response: {
        toolCalls: [
          {
            id: "call_1",
            function: {
              name: "web_search",
              arguments: '{"query":"weather"}',
            },
          },
        ],
      },
    },
  ];
}

function cohereUsageStream() {
  return [
    { eventType: "text-generation", text: "Hello" },
    {
      eventType: "stream-end",
      response: {
        meta: { tokens: { inputTokens: 4, outputTokens: 2 } },
      },
    },
  ];
}

function mockCohere(chunks: Record<string, unknown>[]) {
  const model = new ChatCohere({
    apiKey: "fake-key",
    model: "command-r",
    streaming: true,
  });
  vi.spyOn(model.client, "chatStream").mockResolvedValue({
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

describe("ChatCohere.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockCohere(cohereTextStream()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams tool calls", async () => {
    await expect(
      mockCohere(cohereToolStream()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockCohere(cohereUsageStream()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 4,
      output_tokens: 2,
      total_tokens: 6,
    });
  });

  test("per-call streamUsage false wins over instance default true", async () => {
    const model = mockCohere(cohereUsageStream());
    const chunks = [];
    for await (const chunk of model._streamResponseChunks([], {
      streamUsage: false,
    } as ChatCohereCallOptions)) {
      chunks.push(chunk);
    }
    expect(
      chunks.some(
        (chunk) => chunk.message.usage_metadata !== undefined
      )
    ).toBe(false);
  });

  test("per-call streamUsage true wins over instance false", async () => {
    const model = mockCohere(cohereUsageStream());
    model.streamUsage = false;
    const chunks = [];
    for await (const chunk of model._streamResponseChunks([], {
      streamUsage: true,
    } as ChatCohereCallOptions)) {
      chunks.push(chunk);
    }
    const usageChunk = chunks.find(
      (chunk) => chunk.message.usage_metadata !== undefined
    );
    expect(usageChunk?.message.usage_metadata).toEqual({
      input_tokens: 4,
      output_tokens: 2,
      total_tokens: 6,
    });
  });
});
