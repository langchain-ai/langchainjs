import { test, expect, describe } from "vitest";
import { _makeMessageChunkFromAnthropicEvent } from "../message_outputs.js";

const fields = { streamUsage: true, coerceContentToString: false };

describe("_makeMessageChunkFromAnthropicEvent", () => {
  test("message_start chunk contains correct cache token counts", () => {
    const event = {
      type: "message_start" as const,
      message: {
        id: "msg_01",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-3-5-haiku-latest",
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 1000,
        },
      },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();

    const usage = result!.chunk.usage_metadata!;
    // input_tokens in LangChain = input_tokens + cache_creation + cache_read
    expect(usage.input_tokens).toBe(1600);
    expect(usage.input_token_details?.cache_creation).toBe(500);
    expect(usage.input_token_details?.cache_read).toBe(1000);
  });

  test("message_start model is preserved in response metadata after concat", () => {
    const event = {
      type: "message_start" as const,
      message: {
        id: "msg_01",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "test-model-name",
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 7,
          output_tokens: 0,
        },
      },
    };
    const textDeltaEvent = {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: "Hello" },
    };
    const messageDeltaEvent = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 2 },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const start = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    const textDelta = _makeMessageChunkFromAnthropicEvent(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      textDeltaEvent as any,
      fields
    );
    const messageDelta = _makeMessageChunkFromAnthropicEvent(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      messageDeltaEvent as any,
      fields
    );

    expect(start).not.toBeNull();
    expect(textDelta).not.toBeNull();
    expect(messageDelta).not.toBeNull();

    expect(start!.chunk.response_metadata).toMatchObject({
      model_provider: "anthropic",
      model: "test-model-name",
      usage: {},
    });
    expect(start!.chunk.additional_kwargs.model).toBe("test-model-name");

    const finalMessage = start!.chunk
      .concat(textDelta!.chunk)
      .concat(messageDelta!.chunk);

    expect(finalMessage.response_metadata).toMatchObject({
      model_provider: "anthropic",
      model: "test-model-name",
      usage: {},
    });
    expect(finalMessage.additional_kwargs).toMatchObject({
      id: "msg_01",
      type: "message",
      role: "assistant",
      model: "test-model-name",
      stop_reason: "end_turn",
      stop_sequence: null,
    });
    expect(finalMessage.usage_metadata).toMatchObject({
      input_tokens: 7,
      output_tokens: 2,
      total_tokens: 9,
    });
  });

  test("message_start without model does not throw", () => {
    const event = {
      type: "message_start" as const,
      message: {
        id: "msg_01",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 7,
          output_tokens: 0,
        },
      },
    };
    let result:
      | ReturnType<typeof _makeMessageChunkFromAnthropicEvent>
      | undefined;

    expect(() => {
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    }).not.toThrow();
    expect(result).not.toBeNull();
    expect(result).toBeDefined();
    expect(result!.chunk.response_metadata.model).toBeUndefined();
  });

  test("message_delta chunk has input_tokens=0 and no cache token details", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: {
        input_tokens: 100,
        output_tokens: 42,
        // Anthropic API returns cumulative cache values here — same as message_start
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();

    const usage = result!.chunk.usage_metadata!;
    expect(usage.output_tokens).toBe(42);
    expect(usage.input_tokens).toBe(0);
    expect(usage.input_token_details?.cache_creation).toBeUndefined();
    expect(usage.input_token_details?.cache_read).toBeUndefined();
  });
});
