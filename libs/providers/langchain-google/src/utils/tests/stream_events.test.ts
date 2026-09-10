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
});

describe("tool call ids", () => {
  test("preserves a server-assigned functionCall id across start, delta and finish", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    id: "server-assigned-id-123",
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

    const start = events.find((e) => e.event === "content-block-start") as
      | { content: Record<string, unknown> }
      | undefined;
    const delta = events.find((e) => e.event === "content-block-delta") as
      | { delta: { fields: Record<string, unknown> } }
      | undefined;
    const finish = events.find((e) => e.event === "content-block-finish") as
      | { content: Record<string, unknown> }
      | undefined;

    expect(start?.content.id).toBe("server-assigned-id-123");
    expect(delta?.delta.fields.id).toBe("server-assigned-id-123");
    expect(finish?.content).toMatchObject({
      type: "tool_call",
      name: "web_search",
      args: { query: "weather" },
      id: "server-assigned-id-123",
    });
  });

  test("generates a stable fallback id when Gemini omits one", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
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

    const start = events.find((e) => e.event === "content-block-start") as
      | { content: Record<string, unknown> }
      | undefined;
    const finish = events.find((e) => e.event === "content-block-finish") as
      | { content: Record<string, unknown> }
      | undefined;

    // Same generated shape the non-streaming converter uses.
    expect(start?.content.id).toMatch(/^lc-tool-call-[0-9a-f]{32}$/);
    // One id, not a fresh one per event.
    expect(finish?.content.id).toBe(start?.content.id);
  });

  test("gives concurrent tool calls distinct ids", async () => {
    const events = await collectEvents([
      {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "a", args: {} } },
                { functionCall: { name: "b", args: {} } },
              ],
            },
          },
        ],
      },
    ]);

    const finished = events
      .filter((e) => e.event === "content-block-finish")
      .map((e) => (e as { content: Record<string, unknown> }).content);

    expect(finished).toHaveLength(2);
    expect(finished[0].id).toBeDefined();
    expect(finished[0].id).not.toBe(finished[1].id);
  });
});
