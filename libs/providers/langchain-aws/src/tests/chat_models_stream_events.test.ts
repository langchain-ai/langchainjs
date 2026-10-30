import { describe, expect, test, vi, afterEach } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatBedrockConverse } from "../chat_models.js";

function bedrockTextStream() {
  return [
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { text: "Hello" },
      },
    },
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { text: " world" },
      },
    },
  ];
}

function bedrockReasoningStream() {
  return [
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { reasoningContent: { text: "Let me reason..." } },
      },
    },
  ];
}

function bedrockToolStream() {
  return [
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { text: "Let me search." },
      },
    },
    {
      contentBlockStart: {
        contentBlockIndex: 1,
        start: {
          toolUse: { toolUseId: "toolu_1", name: "web_search" },
        },
      },
    },
    {
      contentBlockDelta: {
        contentBlockIndex: 1,
        delta: { toolUse: { input: '{"query":"weather"}' } },
      },
    },
  ];
}

function bedrockSplitToolArgsStream() {
  return [
    {
      contentBlockStart: {
        contentBlockIndex: 0,
        start: {
          toolUse: { toolUseId: "toolu_1", name: "web_search" },
        },
      },
    },
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { toolUse: { input: "" } },
      },
    },
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { toolUse: { input: '{"query"' } },
      },
    },
    {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: { toolUse: { input: ':"weather"}' } },
      },
    },
  ];
}

function bedrockUsageStream() {
  return [
    {
      metadata: {
        usage: {
          inputTokens: 5,
          outputTokens: 2,
          totalTokens: 7,
        },
      },
    },
  ];
}

function mockBedrock(events: Record<string, unknown>[]) {
  const model = new ChatBedrockConverse({
    model: "anthropic.claude-3-haiku-20240307-v1:0",
    region: "us-east-1",
    credentials: {
      accessKeyId: "fake",
      secretAccessKey: "fake",
    },
  });
  vi.spyOn(model.client, "send").mockResolvedValue({
    stream: (async function* () {
      for (const event of events) {
        yield event;
      }
    })(),
  } as never);
  return model;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatBedrockConverse.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockBedrock(bedrockTextStream()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockBedrock(bedrockReasoningStream()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockBedrock(bedrockToolStream()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams tool call args as slices", async () => {
    const stream = mockBedrock(bedrockSplitToolArgsStream()).streamEvents(
      "Hello"
    );
    const events: ChatModelStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.filter((e) => e.event.startsWith("content-block"))).toEqual([
      {
        event: "content-block-start",
        index: 0,
        content: {
          type: "tool_call_chunk",
          id: "toolu_1",
          name: "web_search",
          args: "",
          index: 0,
        },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: '{"query"' },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: ':"weather"}' },
      },
      {
        event: "content-block-finish",
        index: 0,
        content: {
          type: "tool_call",
          id: "toolu_1",
          name: "web_search",
          args: { query: "weather" },
        },
      },
    ]);
    expect((await stream).tool_calls).toEqual([
      {
        type: "tool_call",
        id: "toolu_1",
        name: "web_search",
        args: { query: "weather" },
      },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockBedrock(bedrockUsageStream()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 5,
      output_tokens: 2,
      total_tokens: 7,
    });
  });

  test("streams thinking token usage", async () => {
    await expect(
      mockBedrock([
        {
          messageStop: {
            stopReason: "end_turn",
            additionalModelResponseFields: {
              usage: {
                output_tokens: 565,
                output_tokens_details: { thinking_tokens: 562 },
              },
            },
          },
        },
        {
          metadata: {
            usage: { inputTokens: 20, outputTokens: 565, totalTokens: 585 },
          },
        },
      ]).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 20,
      output_tokens: 565,
      total_tokens: 585,
      output_token_details: { reasoning: 562 },
    });
  });
});
