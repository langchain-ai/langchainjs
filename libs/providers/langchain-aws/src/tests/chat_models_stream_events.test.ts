import { describe, expect, test, vi, afterEach } from "vitest";
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

describe("ChatBedrockConverse.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockBedrock(bedrockTextStream()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockBedrock(bedrockReasoningStream()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockBedrock(bedrockToolStream()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
