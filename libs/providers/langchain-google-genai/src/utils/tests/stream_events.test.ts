import { describe, test, expect } from "vitest";
import type { EnhancedGenerateContentResponse } from "@google/generative-ai";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import { convertGoogleGenAIStream } from "../stream_events.js";
import {
  _FUNCTION_CALL_THOUGHT_SIGNATURES_MAP_KEY,
  convertMessageContentToParts,
} from "../common.js";

function streamResponses(chunks: Record<string, unknown>[]) {
  async function* source() {
    for (const chunk of chunks) {
      yield chunk as unknown as EnhancedGenerateContentResponse;
    }
  }
  return convertGoogleGenAIStream(source());
}

async function collectEvents(
  chunks: Record<string, unknown>[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  for await (const event of streamResponses(chunks)) {
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

  test("preserves thought signatures and tool call ids", async () => {
    const message = await new ChatModelStream(
      streamResponses([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "planning",
                    thought: true,
                    thoughtSignature: "THOUGHT_SIG",
                  },
                  {
                    functionCall: {
                      name: "get_weather",
                      args: { city: "Paris" },
                    },
                    thoughtSignature: "FC_SIG",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      ])
    );

    expect(message.content).toEqual([
      {
        type: "reasoning",
        reasoning: "planning",
        signature: "THOUGHT_SIG",
      },
      {
        type: "tool_call",
        id: expect.any(String),
        name: "get_weather",
        args: { city: "Paris" },
      },
    ]);

    const toolCallId = message.tool_calls?.[0]?.id;
    expect(toolCallId).toEqual(expect.any(String));
    expect(message.response_metadata).toMatchObject({
      [_FUNCTION_CALL_THOUGHT_SIGNATURES_MAP_KEY]: {
        [toolCallId!]: "FC_SIG",
      },
    });
  });

  test("replays streamed tool calls with their thought signature", async () => {
    const message = await new ChatModelStream(
      streamResponses([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "get_weather",
                      args: { city: "Paris" },
                    },
                    thoughtSignature: "FC_SIG",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      ])
    );

    expect(
      convertMessageContentToParts(message, false, [], "gemini-3.1-pro-preview")
    ).toEqual([
      {
        functionCall: {
          name: "get_weather",
          args: { city: "Paris" },
        },
        thoughtSignature: "FC_SIG",
      },
    ]);
  });
});
