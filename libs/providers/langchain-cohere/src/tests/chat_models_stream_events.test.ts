import { describe, expect, test, vi, afterEach } from "vitest";
import type { Cohere } from "cohere-ai";
import { ChatCohere } from "../chat_models.js";

// Cohere's tool calls carry no id, so ChatCohere generates one: the first 32
// characters of a v4 UUID (see `_formatCohereToolCalls`).
const GENERATED_TOOL_CALL_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{8}$/;

function cohereTextStream(): Cohere.StreamedChatResponse[] {
  return [
    { eventType: "text-generation", text: "Hello" },
    { eventType: "text-generation", text: " world" },
    {
      eventType: "stream-end",
      finishReason: "COMPLETE",
      response: { text: "Hello world" },
    },
  ];
}

function cohereToolStream(): Cohere.StreamedChatResponse[] {
  return [
    { eventType: "text-generation", text: "Let me search." },
    {
      eventType: "stream-end",
      finishReason: "COMPLETE",
      response: {
        text: "Let me search.",
        toolCalls: [{ name: "web_search", parameters: { query: "weather" } }],
      },
    },
  ];
}

function cohereUsageStream(): Cohere.StreamedChatResponse[] {
  return [
    { eventType: "text-generation", text: "Hello" },
    {
      eventType: "stream-end",
      finishReason: "COMPLETE",
      response: {
        text: "Hello",
        meta: { tokens: { inputTokens: 4, outputTokens: 2 } },
      },
    },
  ];
}

function mockCohere(chunks: Cohere.StreamedChatResponse[]) {
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
    const stream = mockCohere(cohereToolStream()).streamEvents("Hello");
    await expect(stream).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
    const [toolCall] = await stream.toolCalls;
    expect(toolCall.id).toMatch(GENERATED_TOOL_CALL_ID);
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
});
