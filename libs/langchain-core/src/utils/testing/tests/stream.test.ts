import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "../../../language_models/event.js";
import { ChatModelStream } from "../../../language_models/stream.js";

async function* iterEvents(
  events: ChatModelStreamEvent[]
): AsyncGenerator<ChatModelStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

function textStreamEvents(): ChatModelStreamEvent[] {
  return [
    { event: "message-start", id: "msg_1" },
    {
      event: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: "Hello" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: " world" },
    },
    {
      event: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    },
    {
      event: "usage",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
    },
    {
      event: "message-finish",
      reason: "stop",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      responseMetadata: { model_name: "test-model" },
    },
  ];
}

describe("stream matchers", () => {
  test("toHaveStreamUsage", async () => {
    const stream = new ChatModelStream(iterEvents(textStreamEvents()));
    await expect(stream).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 12,
    });
  });

  test("toHaveStreamOutput", async () => {
    const stream = new ChatModelStream(iterEvents(textStreamEvents()));
    await expect(stream).toHaveStreamOutput({
      id: "msg_1",
      text: "Hello world",
      usage: { input_tokens: 10, output_tokens: 2 },
      responseMetadata: { finish_reason: "stop", model_name: "test-model" },
    });
  });
});
