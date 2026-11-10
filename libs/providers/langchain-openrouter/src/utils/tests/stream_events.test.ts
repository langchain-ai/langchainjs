import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import type { OpenRouter } from "../../api-types.js";
import type { StreamingChunkData } from "../../converters/messages.js";
import { convertOpenRouterStream } from "../stream_events.js";

function streamChunk(
  delta: OpenRouter.ChatStreamingMessageChunk,
  finish_reason: OpenRouter.ChatCompletionFinishReason | null = null
): StreamingChunkData {
  return {
    id: "gen-1",
    object: "chat.completion.chunk",
    created: 0,
    model: "openai/gpt-4o-mini",
    choices: [{ index: 0, delta, finish_reason }],
  };
}

async function collectEvents(
  chunks: StreamingChunkData[]
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
  test("streams the reasoning field as a reasoning block", async () => {
    const events = await collectEvents([
      streamChunk({ role: "assistant", reasoning: "thinking..." }),
      streamChunk({ content: "Answer" }),
      streamChunk({}, "stop"),
    ]);

    expect(
      events.find(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "reasoning"
      )
    ).toMatchObject({
      content: { reasoning: "thinking..." },
    });

    expect(
      events.find(
        (e) => e.event === "content-block-finish" && e.content.type === "text"
      )
    ).toMatchObject({
      content: { text: "Answer" },
    });
  });
});
