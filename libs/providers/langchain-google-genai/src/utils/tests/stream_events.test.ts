import { describe, test, expect } from "vitest";
import type { EnhancedGenerateContentResponse } from "@google/generative-ai";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertGoogleGenAIStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk as unknown as EnhancedGenerateContentResponse;
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

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { text: "Hello world" },
    });
  });

  test("maps Gemini finish reasons", async () => {
    const lengthEvents = await collectEvents([
      {
        candidates: [
          {
            content: { parts: [{ text: "Hello" }] },
            finishReason: "MAX_TOKENS",
          },
        ],
      },
    ]);
    const lengthFinish = lengthEvents.find((e) => e.event === "message-finish");
    expect(lengthFinish).toMatchObject({ reason: "length" });

    const filterEvents = await collectEvents([
      {
        candidates: [
          {
            content: { parts: [{ text: "Hello" }] },
            finishReason: "SAFETY",
          },
        ],
      },
    ]);
    const filterFinish = filterEvents.find((e) => e.event === "message-finish");
    expect(filterFinish).toMatchObject({ reason: "content_filter" });
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

    expect(
      events.find(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "reasoning"
      )
    ).toMatchObject({
      content: { reasoning: "Let me think" },
    });
  });
});
