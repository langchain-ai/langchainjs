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

  test.each([
    { stopReason: "end_turn", reason: "stop" },
    { stopReason: "tool_use", reason: "tool_use" },
    { stopReason: "max_tokens", reason: "length" },
    { stopReason: "model_context_window_exceeded", reason: "length" },
    { stopReason: "guardrail_intervened", reason: "content_filter" },
  ])(
    "maps the $stopReason stop reason to the $reason finish reason",
    async ({ stopReason, reason }) => {
      const events = await collectEvents([{ messageStop: { stopReason } }]);

      const finish = events.find((e) => e.event === "message-finish");
      expect(finish).toMatchObject({ reason });
    }
  );

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
