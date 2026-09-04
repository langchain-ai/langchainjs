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

  test("message_delta chunk surfaces a gateway-provided cost on response_metadata.usage", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: {
        input_tokens: 100,
        output_tokens: 42,
        cache_read_input_tokens: 1000,
        cost: 0.0123,
      },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();

    expect(result!.chunk.response_metadata).toEqual({
      usage: { cost: 0.0123 },
    });
    expect(result!.chunk.usage_metadata).toMatchObject({
      output_tokens: 42,
    });
  });

  test.each([
    { case: "no cost", usage: { output_tokens: 42 } },
    {
      case: "a nonnumeric cost",
      usage: { output_tokens: 42, cost: "0.0123" },
    },
  ])(
    "message_delta with $case leaves response_metadata unchanged",
    ({ usage }) => {
      const event = {
        type: "message_delta" as const,
        delta: { stop_reason: "end_turn" as const, stop_sequence: null },
        usage,
      };

      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
      expect(result).not.toBeNull();
      expect(result!.chunk.response_metadata).toEqual({});
    }
  );

  test("message_delta cost is preserved when streamUsage is false", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 42, cost: 0.0123 },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, {
      ...fields,
      streamUsage: false,
    });
    expect(result).not.toBeNull();
    expect(result!.chunk.response_metadata).toEqual({
      usage: { cost: 0.0123 },
    });
    expect(result!.chunk.usage_metadata).toBeUndefined();
  });

  test("terminal message_delta cost survives chunk concatenation", () => {
    const messageStart = _makeMessageChunkFromAnthropicEvent(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      {
        type: "message_start" as const,
        message: {
          id: "msg_01",
          type: "message" as const,
          role: "assistant" as const,
          content: [],
          model: "claude-3-5-haiku-latest",
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 0 },
          // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
      fields
    )!.chunk;

    const makeDelta = (usage: Record<string, number>) =>
      _makeMessageChunkFromAnthropicEvent(
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        {
          type: "message_delta" as const,
          delta: { stop_reason: "end_turn" as const, stop_sequence: null },
          usage,
          // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        fields
      )!.chunk;

    const final = messageStart
      .concat(makeDelta({ output_tokens: 20 }))
      .concat(makeDelta({ output_tokens: 42, cost: 0.0123 }));

    expect(final.response_metadata).toEqual({
      model_provider: "anthropic",
      usage: { cost: 0.0123 },
    });
  });
});
