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

describe("ChatCohere.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockCohere(cohereTextStream()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams tool calls", async () => {
    await expect(
      mockCohere(cohereToolStream()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
