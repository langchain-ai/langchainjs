import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOllamaStream,
  type OllamaStreamChunk,
} from "../stream_events.js";

async function collectEvents(
  chunks: OllamaStreamChunk[],
  options?: { think?: boolean }
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertOllamaStream(source(), options)) {
    out.push(event);
  }
  return out;
}

describe("convertOllamaStream", () => {
  test("text-only streaming", async () => {
    const events = await collectEvents([
      { message: { content: "Hello" } },
      { message: { content: " world" } },
      { message: {}, done_reason: "stop" },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    const finish = events.find((e) => e.event === "content-block-finish") as {
      content: { text: string };
    };
    expect(finish.content.text).toBe("Hello world");
  });

  test("thinking when think option enabled", async () => {
    const events = await collectEvents(
      [{ message: { thinking: "hmm" } }, { message: {}, done_reason: "stop" }],
      { think: true }
    );

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "reasoning"
    ) as { content: { reasoning: string } };
    expect(reasoningFinish.content.reasoning).toBe("hmm");
  });

  test("usage from token counts", async () => {
    const events = await collectEvents([
      {
        message: { content: "Hi" },
        prompt_eval_count: 10,
        eval_count: 3,
      },
      { message: {}, done_reason: "stop" },
    ]);

    expect(events.filter((e) => e.event === "usage").length).toBeGreaterThan(0);
  });
});
