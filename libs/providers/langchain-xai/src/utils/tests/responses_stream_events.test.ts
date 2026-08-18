import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import type { XAIResponsesStreamEvent } from "../../chat_models/responses-types.js";
import { convertXAIResponsesStream } from "../responses_stream_events.js";

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collectEvents(
  events: XAIResponsesStreamEvent[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  for await (const event of convertXAIResponsesStream(
    asAsyncIterable(events)
  )) {
    out.push(event);
  }
  return out;
}

describe("convertXAIResponsesStream", () => {
  test("text-only lifecycle", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_xai", model: "grok-3" },
      } as XAIResponsesStreamEvent,
      {
        type: "response.output_text.delta",
        delta: "Hello",
        content_index: 0,
        output_index: 0,
      } as XAIResponsesStreamEvent,
      {
        type: "response.completed",
        response: {
          id: "resp_xai",
          object: "response",
          created_at: 0,
          status: "completed",
          model: "grok-3",
          output: [],
          usage: {
            input_tokens: 5,
            output_tokens: 2,
            total_tokens: 7,
          },
        },
      } as XAIResponsesStreamEvent,
    ]);

    expect(events.map((e) => e.event)).toContain("message-finish");
    const providerMeta = events.find(
      (e) =>
        e.event === "provider" &&
        (e as { name: string }).name === "response.created"
    ) as { provider: string };
    expect(providerMeta.provider).toBe("xai");
  });

  test("reasoning summary deltas", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_r", model: "grok-3" },
      } as XAIResponsesStreamEvent,
      {
        type: "response.reasoning_summary_text.delta",
        delta: "thinking",
        summary_index: 0,
        output_index: 0,
      } as XAIResponsesStreamEvent,
      {
        type: "response.completed",
        response: {
          id: "resp_r",
          status: "completed",
          model: "grok-3",
          output: [],
        },
      } as XAIResponsesStreamEvent,
    ]);

    const reasoning = events.filter(
      (e) =>
        e.event === "content-block-delta" &&
        (e as { delta: { type: string } }).delta.type === "reasoning-delta"
    );
    expect(reasoning.length).toBeGreaterThanOrEqual(1);
  });
});
