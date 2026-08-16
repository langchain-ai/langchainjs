import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertCloudflareStream } from "../stream_events.js";

async function collectEvents(
  chunks: { response?: string }[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertCloudflareStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertCloudflareStream", () => {
  test("concatenates response chunks", async () => {
    const events = await collectEvents([
      { response: "Hello" },
      { response: " world" },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { text: "Hello world" },
    });
  });
});
