import { afterEach, describe, expect, test, vi } from "vitest";
import type { Cohere } from "cohere-ai";
import type { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { ChatCohere, type ChatCohereInput } from "../chat_models.js";

// Cohere's tool calls carry no id, so ChatCohere generates one: the first 32
// characters of a v4 UUID (see `_formatCohereToolCalls`).
const GENERATED_TOOL_CALL_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{8}$/;

const COHERE_TOOL_CALLS: Cohere.ToolCall[] = [
  { name: "web_search", parameters: { query: "weather" } },
  { name: "get_time", parameters: { timezone: "UTC" } },
];

// The finished tool calls arrive in `tool-calls-generation` and again in the
// `stream-end` response. ChatCohere reads them from `stream-end` only.
function cohereToolStream(): Cohere.StreamedChatResponse[] {
  return [
    { eventType: "text-generation", text: "Let me check." },
    {
      eventType: "tool-calls-generation",
      text: "Let me check.",
      toolCalls: COHERE_TOOL_CALLS,
    },
    {
      eventType: "stream-end",
      finishReason: "COMPLETE",
      response: {
        text: "Let me check.",
        toolCalls: COHERE_TOOL_CALLS,
        meta: { tokens: { inputTokens: 4, outputTokens: 2 } },
      },
    },
  ];
}

function mockCohere(
  chunks: Cohere.StreamedChatResponse[],
  fields: Partial<ChatCohereInput> = {}
) {
  const model = new ChatCohere({
    apiKey: "fake-key",
    model: "command-r",
    ...fields,
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

async function streamToMessage(model: ChatCohere): Promise<AIMessageChunk> {
  let message: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("What's the weather?")) {
    message = message === undefined ? chunk : concat(message, chunk);
  }
  if (message === undefined) {
    throw new Error("The stream yielded no chunks.");
  }
  return message;
}

function expectValidToolCalls(message: AIMessage) {
  expect(message.invalid_tool_calls).toEqual([]);
  expect(message.tool_calls).toEqual([
    {
      name: "web_search",
      args: { query: "weather" },
      id: expect.stringMatching(GENERATED_TOOL_CALL_ID),
      type: "tool_call",
    },
    {
      name: "get_time",
      args: { timezone: "UTC" },
      id: expect.stringMatching(GENERATED_TOOL_CALL_ID),
      type: "tool_call",
    },
  ]);
  expect(new Set(message.tool_calls?.map((toolCall) => toolCall.id)).size).toBe(
    2
  );
}

const USAGE = { input_tokens: 4, output_tokens: 2, total_tokens: 6 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatCohere.stream", () => {
  test.each([true, false])(
    "returns Cohere's tool calls as valid tool calls (streamUsage: %s)",
    async (streamUsage) => {
      const message = await streamToMessage(
        mockCohere(cohereToolStream(), { streamUsage })
      );
      expect(message.content).toBe("Let me check.");
      expectValidToolCalls(message);
      expect(message.usage_metadata).toEqual(
        streamUsage ? expect.objectContaining(USAGE) : undefined
      );
    }
  );

  test("gives each tool call chunk JSON args and its position as index", async () => {
    const message = await streamToMessage(mockCohere(cohereToolStream()));
    expect(
      message.tool_call_chunks?.map(({ name, args, index }) => ({
        name,
        args,
        index,
      }))
    ).toEqual([
      { name: "web_search", args: '{"query":"weather"}', index: 0 },
      { name: "get_time", args: '{"timezone":"UTC"}', index: 1 },
    ]);
  });
});

describe("ChatCohere.invoke with streaming: true", () => {
  test.each([true, false])(
    "returns Cohere's tool calls as valid tool calls (streamUsage: %s)",
    async (streamUsage) => {
      const message = await mockCohere(cohereToolStream(), {
        streaming: true,
        streamUsage,
      }).invoke("What's the weather?");
      expect(message.content).toBe("Let me check.");
      expectValidToolCalls(message);
      expect(message.usage_metadata).toEqual(
        streamUsage ? expect.objectContaining(USAGE) : undefined
      );
    }
  );
});
