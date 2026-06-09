import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertMistralStream } from "../stream_events.js";

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  for await (const event of convertMistralStream(source())) {
    out.push(event);
  }
  return out;
}

describe("convertMistralStream", () => {
  test("maps camelCase toolCalls to OpenAI shape", async () => {
    const events = await collectEvents([
      {
        id: "cmpl-1",
        object: "chat.completion.chunk",
        created: 0,
        model: "mistral-small",
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant",
              toolCalls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "get_weather", arguments: '{"loc":' },
                },
              ],
            },
            finishReason: null,
          },
        ],
      },
      {
        id: "cmpl-1",
        object: "chat.completion.chunk",
        created: 0,
        model: "mistral-small",
        choices: [
          {
            index: 0,
            delta: {
              toolCalls: [
                {
                  index: 0,
                  type: "function",
                  function: { arguments: '"NYC"}' },
                },
              ],
            },
            finishReason: "tool_calls",
          },
        ],
      },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    const toolStarts = events.filter(
      (e) =>
        e.event === "content-block-start" &&
        e.content.type === "tool_call_chunk"
    );
    expect(toolStarts.length).toBeGreaterThanOrEqual(1);

    expect(
      events.find(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "tool_call"
      )
    ).toMatchObject({
      content: {
        name: "get_weather",
        args: { loc: "NYC" },
      },
    });
  });

  test("text-only streaming", async () => {
    const events = await collectEvents([
      {
        choices: [{ index: 0, delta: { content: "Hi" }, finishReason: null }],
      },
      {
        choices: [{ index: 0, delta: {}, finishReason: "stop" }],
      },
    ]);

    expect(events.find((e) => e.event === "content-block-finish")).toMatchObject(
      {
        content: { text: "Hi" },
      }
    );
  });
});
