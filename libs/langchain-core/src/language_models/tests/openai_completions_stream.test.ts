import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "../event.js";
import {
  convertOpenAICompletionsStream,
  type OpenAICompletionsStreamChunk,
} from "../openai_completions_stream.js";

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collectEvents(
  chunks: OpenAICompletionsStreamChunk[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  for await (const event of convertOpenAICompletionsStream(
    asAsyncIterable(chunks)
  )) {
    out.push(event);
  }
  return out;
}

describe("convertOpenAICompletionsStream", () => {
  test("text-only lifecycle", async () => {
    const events = await collectEvents([
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello" },
            finish_reason: null,
          },
        ],
      },
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: { content: " world" },
            finish_reason: null,
          },
        ],
      },
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    const finish = events.find((e) => e.event === "content-block-finish") as {
      content: { text: string };
    };
    expect(finish.content.text).toBe("Hello world");
  });

  test("reasoning_content deltas", async () => {
    const events = await collectEvents([
      {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", reasoning_content: "think" },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
    ]);

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "reasoning"
    ) as { content: { reasoning: string } };
    expect(reasoningFinish.content.reasoning).toBe("think");
  });
});
