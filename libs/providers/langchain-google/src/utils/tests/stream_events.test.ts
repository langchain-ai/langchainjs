import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertGoogleGeminiStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertGoogleGeminiStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertGoogleGeminiStream", () => {
  test("text-only streaming", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: { parts: [{ text: "Hello" }] },
          },
        ],
      },
      {
        candidates: [
          {
            content: { parts: [{ text: " world" }] },
          },
        ],
      },
    ]);

    const textDeltas = events.filter(
      (e) =>
        e.event === "content-block-delta" &&
        (e as { delta: { type: string } }).delta.type === "text-delta"
    );
    expect(textDeltas).toHaveLength(2);

    const finish = events.find((e) => e.event === "content-block-finish") as {
      content: { text: string };
    };
    expect(finish.content.text).toBe("Hello world");
  });

  test("thinking parts map to reasoning", async () => {
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

  test("usage snapshots", async () => {
    const events = await collectEvents([
      {
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 4,
          totalTokenCount: 14,
        },
        candidates: [{ content: { parts: [{ text: "Hi" }] } }],
      },
    ]);

    expect(events.filter((e) => e.event === "usage").length).toBe(1);
  });
});
