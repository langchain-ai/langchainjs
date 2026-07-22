import { test, expect } from "vitest";
import { _makeMessageChunkFromAnthropicEvent } from "../utils/message_outputs.js";

test("_makeMessageChunkFromAnthropicEvent includes model in response_metadata on message_start", () => {
  const event = {
    type: "message_start",
    message: {
      id: "msg_123",
      type: "message",
      role: "assistant",
      model: "claude-3-5-sonnet-20241022",
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 1,
      },
    },
  } as const;

  const result = _makeMessageChunkFromAnthropicEvent(event as any, {
    streamUsage: true,
    coerceContentToString: false,
  });

  expect(result).not.toBeNull();
  expect(result?.chunk.response_metadata).toEqual({
    model_provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    usage: {},
  });
});
