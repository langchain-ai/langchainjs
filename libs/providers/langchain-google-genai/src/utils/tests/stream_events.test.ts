import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertGoogleGenAIStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertGoogleGenAIStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertGoogleGenAIStream", () => {
  test("text-only streaming", async () => {
    const events = await collectEvents([
      {
        candidates: [{ content: { parts: [{ text: "Hello" }] } }],
      },
      {
        candidates: [{ content: { parts: [{ text: " world" }] } }],
      },
    ]);

    const finish = events.find((e) => e.event === "content-block-finish") as {
      content: { text: string };
    };
    expect(finish.content.text).toBe("Hello world");
  });

  test("thought parts map to reasoning", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Let me think", thought: true }],
            },
          },
        ],
      },
    ]);

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" &&
        (e as { content: { type: string } }).content.type === "reasoning"
    ) as { content: { reasoning: string } };
    expect(reasoningFinish.content.reasoning).toBe("Let me think");
  });
});
