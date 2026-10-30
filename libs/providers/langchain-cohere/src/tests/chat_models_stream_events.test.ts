import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatCohere } from "../chat_models.js";

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

  describe("streamUsage call option", () => {
    async function collectUsage(
      model: ChatCohere,
      streamUsage: boolean
    ): Promise<unknown[]> {
      const usages: unknown[] = [];
      for await (const chunk of await model.stream("Hello", { streamUsage })) {
        if (chunk.usage_metadata) usages.push(chunk.usage_metadata);
      }
      return usages;
    }

    test("call option streamUsage: false overrides the instance default", async () => {
      const model = mockCohere(cohereUsageStream());
      expect(model.streamUsage).toBe(true);

      expect(await collectUsage(model, false)).toEqual([]);
    });

    test("call option streamUsage: true overrides an instance streamUsage of false", async () => {
      const model = mockCohere(cohereUsageStream());
      model.streamUsage = false;

      expect(await collectUsage(model, true)).toEqual([
        { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      ]);
    });
  });
});
