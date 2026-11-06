import { test, expect, describe } from "vitest";
import {
  type AnthropicStreamUsageState,
  _makeMessageChunkFromAnthropicEvent,
} from "../message_outputs.js";

const makeFields = () => ({
  streamUsage: true,
  coerceContentToString: false,
  usageState: {} as AnthropicStreamUsageState,
});

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

    const result = _makeMessageChunkFromAnthropicEvent(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      event as any,
      makeFields()
    );
    expect(result).not.toBeNull();

    const usage = result!.chunk.usage_metadata!;
    // input_tokens in LangChain = input_tokens + cache_creation + cache_read
    expect(usage.input_tokens).toBe(1600);
    expect(usage.input_token_details?.cache_creation).toBe(500);
    expect(usage.input_token_details?.cache_read).toBe(1000);
  });

  test("message_delta chunk with unchanged cumulative cache totals adds no input tokens", () => {
    const fields = makeFields();
    _makeMessageChunkFromAnthropicEvent(
      {
        type: "message_start",
        message: {
          id: "msg_01",
          content: [],
          usage: {
            input_tokens: 100,
            output_tokens: 1,
            cache_creation_input_tokens: 500,
            cache_read_input_tokens: 1000,
          },
        },
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      fields
    );
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
    expect(usage.output_tokens).toBe(41);
    expect(usage.input_tokens).toBe(0);
    expect(usage.input_token_details).toEqual({
      cache_creation: 0,
      cache_read: 0,
    });
  });

  test("message_delta chunk surfaces a gateway-provided cost on response_metadata.usage", () => {
    const event = {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: {
        input_tokens: 100,
        output_tokens: 42,
        cost: 0.0123,
      },
    };

    const result = _makeMessageChunkFromAnthropicEvent(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      event as any,
      makeFields()
    );
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

      const result = _makeMessageChunkFromAnthropicEvent(
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        event as any,
        makeFields()
      );
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
      ...makeFields(),
      streamUsage: false,
    });
    expect(result).not.toBeNull();
    expect(result!.chunk.response_metadata).toEqual({
      usage: { cost: 0.0123 },
    });
    expect(result!.chunk.usage_metadata).toBeUndefined();
  });

  test("terminal message_delta cost survives chunk concatenation", () => {
    const fields = makeFields();
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

describe("_makeMessageChunkFromAnthropicEvent cumulative usage", () => {
  const messageStart = (usage: Record<string, unknown>) => ({
    type: "message_start" as const,
    message: {
      id: "msg_01",
      type: "message" as const,
      role: "assistant" as const,
      content: [],
      model: "claude-sonnet-4-5",
      stop_reason: null,
      stop_sequence: null,
      usage,
    },
  });
  const messageDelta = (usage: Record<string, unknown>) => ({
    type: "message_delta" as const,
    delta: { stop_reason: "end_turn" as const, stop_sequence: null },
    usage,
  });

  function streamMessage(
    events: (
      | ReturnType<typeof messageStart>
      | ReturnType<typeof messageDelta>
    )[]
  ) {
    const usageState: AnthropicStreamUsageState = {};
    return events
      .map(
        (event) =>
          _makeMessageChunkFromAnthropicEvent(
            // oxlint-disable-next-line @typescript-eslint/no-explicit-any
            event as any,
            { ...makeFields(), usageState }
          )!.chunk
      )
      .reduce((acc, chunk) => acc.concat(chunk));
  }
  const streamUsage = (events: Parameters<typeof streamMessage>[0]) =>
    streamMessage(events).usage_metadata;

  test("uses the final input totals when server tools add model passes", () => {
    const usage = streamUsage([
      messageStart({
        input_tokens: 2800,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      }),
      messageDelta({
        input_tokens: 26000,
        output_tokens: 900,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      }),
    ]);

    expect(usage).toEqual({
      input_tokens: 26000,
      output_tokens: 900,
      total_tokens: 26900,
      input_token_details: { cache_creation: 0, cache_read: 0 },
      output_token_details: {},
    });
  });

  test("does not double count unchanged cache totals", () => {
    const usage = streamUsage([
      messageStart({
        input_tokens: 100,
        output_tokens: 1,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      }),
      messageDelta({
        input_tokens: 100,
        output_tokens: 42,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      }),
    ]);

    expect(usage).toMatchObject({
      input_tokens: 1600,
      output_tokens: 42,
      total_tokens: 1642,
      input_token_details: { cache_creation: 500, cache_read: 1000 },
    });
  });

  test("tracks cache totals that grow during the request", () => {
    const usage = streamUsage([
      messageStart({
        input_tokens: 100,
        output_tokens: 1,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
      }),
      messageDelta({
        input_tokens: 300,
        output_tokens: 42,
        cache_creation_input_tokens: 700,
        cache_read_input_tokens: 3000,
      }),
    ]);

    expect(usage).toMatchObject({
      input_tokens: 4000,
      output_tokens: 42,
      total_tokens: 4042,
      input_token_details: { cache_creation: 700, cache_read: 3000 },
    });
  });

  test("keeps message_start values for fields the delta omits or nulls", () => {
    const usage = streamUsage([
      messageStart({
        input_tokens: 100,
        output_tokens: 1,
        cache_read_input_tokens: 1000,
      }),
      messageDelta({ output_tokens: 42, cache_read_input_tokens: null }),
    ]);

    expect(usage).toMatchObject({
      input_tokens: 1100,
      output_tokens: 42,
      total_tokens: 1142,
      input_token_details: { cache_creation: 0, cache_read: 1000 },
    });
  });

  test("multiple message_delta events are not summed", () => {
    const usage = streamUsage([
      messageStart({ input_tokens: 100, output_tokens: 1 }),
      messageDelta({ input_tokens: 400, output_tokens: 20 }),
      messageDelta({ input_tokens: 900, output_tokens: 42 }),
    ]);

    expect(usage).toMatchObject({
      input_tokens: 900,
      output_tokens: 42,
      total_tokens: 942,
    });
  });

  test("response_metadata.usage ends with the final cache and server tool totals", () => {
    const message = streamMessage([
      messageStart({
        input_tokens: 2800,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 1000,
        server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
        service_tier: "standard",
      }),
      messageDelta({
        input_tokens: 9000,
        output_tokens: 300,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 2000,
        server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 },
      }),
      messageDelta({
        input_tokens: 26000,
        output_tokens: 900,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 4000,
        server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 },
      }),
    ]);

    expect(message.response_metadata.usage).toEqual({
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 4000,
      server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 },
      service_tier: "standard",
    });
  });
});
