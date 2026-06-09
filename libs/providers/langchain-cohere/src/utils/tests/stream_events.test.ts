import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertCohereStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
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
        response: {
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
});
