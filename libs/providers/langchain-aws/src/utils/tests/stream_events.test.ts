import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertBedrockConverseStream } from "../stream_events.js";

async function collectEvents(
  events: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const event of events) {
      yield event;
    }
  }
  for await (const event of convertBedrockConverseStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertBedrockConverseStream", () => {
  test("preserves reasoning signatures and keeps text blocks separate", async () => {
    const events = await collectEvents([
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: { reasoningContent: { text: "Let me check. " } },
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: { reasoningContent: { signature: "sig-abc-123" } },
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 1,
          delta: { text: "The answer is 4." },
        },
      },
    ]);

    expect(events.filter((e) => e.event === "content-block-finish")).toEqual([
      {
        event: "content-block-finish",
        index: 0,
        content: {
          type: "reasoning",
          reasoning: "Let me check. ",
          signature: "sig-abc-123",
        },
      },
      {
        event: "content-block-finish",
        index: 1,
        content: { type: "text", text: "The answer is 4." },
      },
    ]);
    expect(events).toContainEqual({
      event: "content-block-delta",
      index: 0,
      delta: {
        type: "block-delta",
        fields: { type: "reasoning", signature: "sig-abc-123" },
      },
    });
    expect(
      events.filter((e) => e.event === "content-block-start")
    ).toHaveLength(2);
  });

  test("accumulates signature-only reasoning deltas", async () => {
    const events = await collectEvents([
      {
        contentBlockDelta: {
          contentBlockIndex: 2,
          delta: { reasoningContent: { signature: "sig-" } },
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 2,
          delta: { reasoningContent: { signature: "abc" } },
        },
      },
    ]);
    expect(events.filter((e) => e.event === "content-block-start")).toEqual([
      {
        event: "content-block-start",
        index: 2,
        content: { type: "reasoning", reasoning: "" },
      },
    ]);
    expect(events.find((e) => e.event === "content-block-finish")).toEqual({
      event: "content-block-finish",
      index: 2,
      content: { type: "reasoning", reasoning: "", signature: "sig-abc" },
    });
    expect(
      events.filter((e) => e.event === "content-block-delta").at(-1)
    ).toMatchObject({
      delta: { fields: { signature: "sig-abc" } },
    });
  });

  test("text deltas", async () => {
    const events = await collectEvents([
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
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { text: "Hello world" },
    });
  });

  test("usage metadata", async () => {
    const events = await collectEvents([
      {
        metadata: {
          usage: {
            inputTokens: 5,
            outputTokens: 2,
            totalTokens: 7,
          },
        },
      },
    ]);

    expect(events.some((e) => e.event === "usage")).toBe(true);
  });

  test("maps message stop reason", async () => {
    const events = await collectEvents([
      {
        messageStop: {
          stopReason: "max_tokens",
        },
      },
    ]);

    const finish = events.find((e) => e.event === "message-finish");
    expect(finish).toMatchObject({
      event: "message-finish",
      reason: "length",
    });
  });

  test("maps thinking tokens from messageStop into usage", async () => {
    const messageStop = {
      messageStop: {
        stopReason: "end_turn",
        additionalModelResponseFields: {
          usage: {
            output_tokens: 565,
            output_tokens_details: { thinking_tokens: 562 },
          },
        },
      },
    };
    const metadata = {
      metadata: {
        usage: { inputTokens: 20, outputTokens: 565, totalTokens: 585 },
      },
    };

    for (const order of [
      [messageStop, metadata],
      [metadata, messageStop],
    ]) {
      const events = await collectEvents(order);
      const finish = events.find((e) => e.event === "message-finish");
      expect(finish).toMatchObject({
        usage: {
          output_tokens: 565,
          output_token_details: { reasoning: 562 },
        },
      });
    }
  });
});
