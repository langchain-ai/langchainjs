import { test, expect, describe } from "vitest";
import { _makeMessageChunkFromAnthropicEvent } from "../message_outputs.js";

const fields = { streamUsage: true, coerceContentToString: false };

describe("_makeMessageChunkFromAnthropicEvent", () => {
  test("message_start chunk carries no usage", () => {
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
          output_tokens: 1,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 1000,
        },
      },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();
    expect(result!.chunk.usage_metadata).toBeUndefined();
    expect(result!.chunk.response_metadata).toEqual({
      model_provider: "anthropic",
    });
  });

  test("message_delta chunk carries the cumulative usage for the request", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: {
        input_tokens: 100,
        output_tokens: 42,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();
    // input_tokens in LangChain = input_tokens + cache_creation + cache_read
    expect(result!.chunk.usage_metadata).toEqual({
      input_tokens: 1600,
      output_tokens: 42,
      total_tokens: 1642,
      input_token_details: { cache_creation: 500, cache_read: 1000 },
    });
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
      usage: { cache_read_input_tokens: 1000, cost: 0.0123 },
    });
    expect(result!.chunk.usage_metadata).toMatchObject({
      output_tokens: 42,
    });
  });

  test("message_delta with no cost leaves response_metadata unchanged", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 42 },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();
    expect(result!.chunk.response_metadata).toEqual({});
  });

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

    const final = messageStart.concat(
      makeDelta({ output_tokens: 42, cost: 0.0123 })
    );

    expect(final.response_metadata).toEqual({
      model_provider: "anthropic",
      usage: { cost: 0.0123 },
    });
  });

  test("merged message has the final totals when server tools add model passes", () => {
    const messageStart = _makeMessageChunkFromAnthropicEvent(
      {
        type: "message_start" as const,
        message: {
          id: "msg_01",
          content: [],
          usage: {
            input_tokens: 2800,
            output_tokens: 1,
            server_tool_use: { web_search_requests: 0 },
          },
        },
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      fields
    )!.chunk;
    const messageDelta = _makeMessageChunkFromAnthropicEvent(
      {
        type: "message_delta" as const,
        delta: { stop_reason: "end_turn" as const, stop_sequence: null },
        usage: {
          input_tokens: 26000,
          output_tokens: 900,
          server_tool_use: { web_search_requests: 2 },
        },
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      fields
    )!.chunk;

    const final = messageStart.concat(messageDelta);

    // The delta is cumulative, so the first pass isn't added on top.
    expect(final.usage_metadata).toMatchObject({
      input_tokens: 26000,
      output_tokens: 900,
      total_tokens: 26900,
    });
    expect(final.response_metadata.usage).toEqual({
      server_tool_use: { web_search_requests: 2 },
    });
  });

  test.each([
    {
      case: "only output_tokens",
      delta: { output_tokens: 42 },
      expected: { input_tokens: 1600, cache_creation: 500, cache_read: 1000 },
    },
    {
      case: "input_tokens but no cache fields",
      delta: { input_tokens: 300, output_tokens: 42 },
      expected: { input_tokens: 1800, cache_creation: 500, cache_read: 1000 },
    },
    {
      case: "null cache fields",
      delta: {
        input_tokens: 300,
        output_tokens: 42,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
      expected: { input_tokens: 1800, cache_creation: 500, cache_read: 1000 },
    },
  ])(
    "message_delta with $case keeps the message_start values",
    ({ delta, expected }) => {
      const startUsage = {
        input_tokens: 100,
        output_tokens: 1,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      };
      const result = _makeMessageChunkFromAnthropicEvent(
        {
          type: "message_delta" as const,
          delta: { stop_reason: "end_turn" as const, stop_sequence: null },
          usage: delta,
          // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { ...fields, startUsage }
      );

      expect(result!.chunk.usage_metadata).toEqual({
        input_tokens: expected.input_tokens,
        output_tokens: 42,
        total_tokens: expected.input_tokens + 42,
        input_token_details: {
          cache_creation: expected.cache_creation,
          cache_read: expected.cache_read,
        },
      });
    }
  );
});
