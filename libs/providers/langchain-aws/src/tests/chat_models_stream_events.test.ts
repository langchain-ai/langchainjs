import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatBedrockConverse } from "../chat_models.js";
import { HumanMessage } from "@langchain/core/messages";
import { convertToConverseMessages } from "../utils/message_inputs.js";

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
  test("preserves reasoning signatures when replaying streamed output", async () => {
    const events = [
      ...bedrockReasoningStream(),
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: { reasoningContent: { signature: "opaque-signature" } },
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 1,
          delta: { text: "Answer" },
        },
      },
    ];
    const result = await mockBedrock(events).streamEvents("Hello").output;
    expect(result.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Let me reason...",
        signature: "opaque-signature",
      },
      { type: "text", text: "Answer" },
    ]);
    const { converseMessages } = convertToConverseMessages([
      new HumanMessage("Hello"),
      result,
    ]);
    expect(converseMessages[1].content).toEqual([
      {
        reasoningContent: {
          reasoningText: {
            text: "Let me reason...",
            signature: "opaque-signature",
          },
        },
      },
      { text: "Answer" },
    ]);
  });

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
