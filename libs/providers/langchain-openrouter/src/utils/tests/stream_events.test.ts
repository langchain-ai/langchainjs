import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertOpenRouterStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertOpenRouterStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertOpenRouterStream", () => {
  test("maps reasoning field to reasoning_content", async () => {
    const events = await collectEvents([
      {
        id: "gen-1",
        choices: [
          {
            index: 0,
            delta: { role: "assistant", reasoning: "thinking..." },
            finish_reason: null,
          },
        ],
      },
      {
        id: "gen-1",
        choices: [
          {
            index: 0,
            delta: { content: "Answer" },
            finish_reason: null,
          },
        ],
      },
      {
        id: "gen-1",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
    ]);

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "reasoning"
    ) as { content: { reasoning: string } };
    expect(reasoningFinish.content.reasoning).toBe("thinking...");

    const textFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "text"
    ) as { content: { text: string } };
    expect(textFinish.content.text).toBe("Answer");
  });
});
