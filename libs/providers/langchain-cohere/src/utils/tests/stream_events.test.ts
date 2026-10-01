import { describe, test, expect } from "vitest";
import type { Cohere } from "cohere-ai";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertCohereStream } from "../stream_events.js";

// Cohere's tool calls carry no id, so ChatCohere generates one: the first 32
// characters of a v4 UUID (see `_formatCohereToolCalls`).
const GENERATED_TOOL_CALL_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{8}$/;

async function collectEvents(
  chunks: Cohere.StreamedChatResponse[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertCohereStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertCohereStream", () => {
  test("text-generation events", async () => {
    const events = await collectEvents([
      { eventType: "text-generation", text: "Hello" },
      { eventType: "text-generation", text: " world" },
      {
        eventType: "stream-end",
        finishReason: "COMPLETE",
        response: {
          text: "Hello world",
          meta: { tokens: { inputTokens: 4, outputTokens: 2 } },
        },
      },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { text: "Hello world" },
    });
    expect(events.some((e) => e.event === "usage")).toBe(true);
  });

  test("stream-end tool calls", async () => {
    const events = await collectEvents([
      { eventType: "text-generation", text: "Let me search." },
      {
        eventType: "stream-end",
        finishReason: "COMPLETE",
        response: {
          text: "Let me search.",
          toolCalls: [{ name: "web_search", parameters: { query: "weather" } }],
        },
      },
    ]);

    expect(
      events.filter(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "tool_call"
      )
    ).toEqual([
      {
        event: "content-block-finish",
        index: 1,
        content: {
          type: "tool_call",
          id: expect.stringMatching(GENERATED_TOOL_CALL_ID),
          name: "web_search",
          args: { query: "weather" },
        },
      },
    ]);
  });
});
