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

    expect(
      events.find(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "reasoning"
      )
    ).toMatchObject({
      content: { reasoning: "Let me think" },
    });
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

  test("threads a model-provided tool call id through start, delta, and finish", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    id: "server-id-1",
                    name: "web_search",
                    args: { query: "weather" },
                  },
                  thoughtSignature: "sig-1",
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(events.find((e) => e.event === "content-block-start")).toMatchObject(
      { content: { id: "server-id-1" } }
    );
    expect(events.find((e) => e.event === "content-block-delta")).toMatchObject(
      { delta: { fields: { id: "server-id-1" } } }
    );
    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { id: "server-id-1", thoughtSignature: "sig-1" },
    });
  });

  test("generates a fallback id when Gemini omits it", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "web_search", args: { query: "x" } } },
              ],
            },
          },
        ],
      },
    ]);

    const start = events.find((e) => e.event === "content-block-start");
    expect((start as { content: { id: string } }).content.id).toMatch(
      /^lc-tool-call-/
    );
  });

  test("keeps the same id across chunks for the same tool call", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "web_search", args: { query: "w" } } },
              ],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    id: "late-server-id",
                    name: "web_search",
                    args: { query: "weather" },
                  },
                },
              ],
            },
          },
        ],
      },
    ]);

    const deltaIds = events
      .filter((e) => e.event === "content-block-delta")
      .map((e) => (e as { delta: { fields: { id: string } } }).delta.fields.id);
    const startId = (
      events.find((e) => e.event === "content-block-start") as {
        content: { id: string };
      }
    ).content.id;
    const finishId = (
      events.find((e) => e.event === "content-block-finish") as {
        content: { id: string };
      }
    ).content.id;

    expect(new Set(deltaIds).size).toBe(1);
    expect(deltaIds[0]).toBe(startId);
    expect(finishId).toBe(startId);
    expect(finishId).not.toBe("late-server-id");
  });

  test("generates distinct ids for concurrent tool calls", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "first_tool", args: {} } },
                { functionCall: { name: "second_tool", args: {} } },
              ],
            },
          },
        ],
      },
    ]);

    const ids = events
      .filter((e) => e.event === "content-block-start")
      .map((e) => (e as { content: { id: string } }).content.id);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^lc-tool-call-/);
    expect(ids[1]).toMatch(/^lc-tool-call-/);
    expect(new Set(ids).size).toBe(2);
  });
});
