import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertWatsonxStream } from "../stream_events.js";

async function collectEvents(
  wrappers: { data: Record<string, unknown> }[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const wrapper of wrappers) {
      yield wrapper;
    }
  }
  for await (const event of convertWatsonxStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertWatsonxStream", () => {
  test("unwraps watsonx data and streams text", async () => {
    const events = await collectEvents([
      {
        data: {
          id: "wx-1",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
            },
          ],
        },
      },
      {
        data: {
          id: "wx-1",
          choices: [
            {
              index: 0,
              delta: { content: " world" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 2,
            total_tokens: 7,
          },
        },
      },
    ]);

    const finish = events.find((e) => e.event === "content-block-finish") as {
      content: { text: string };
    };
    expect(finish.content.text).toBe("Hello world");
    expect(events.some((e) => e.event === "usage")).toBe(true);
  });

  test("maps reasoning to reasoning_content", async () => {
    const events = await collectEvents([
      {
        data: {
          choices: [
            {
              index: 0,
              delta: { reasoning: "step 1" },
              finish_reason: null,
            },
          ],
        },
      },
      {
        data: {
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        },
      },
    ]);

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "reasoning"
    ) as { content: { reasoning: string } };
    expect(reasoningFinish.content.reasoning).toBe("step 1");
  });
});
