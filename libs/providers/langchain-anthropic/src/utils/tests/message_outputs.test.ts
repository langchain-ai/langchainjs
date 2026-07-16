import { test, expect, describe } from "vitest";
import { _makeMessageChunkFromAnthropicEvent } from "../message_outputs.js";

const fields = { streamUsage: true, coerceContentToString: false };

describe("_makeMessageChunkFromAnthropicEvent", () => {
  test("keeps streamed server tool args raw while JSON is incomplete", () => {
    const startEvent = {
      type: "content_block_start" as const,
      index: 1,
      content_block: {
        type: "server_tool_use" as const,
        id: "srvtoolu_01",
        name: "web_search",
        input: "",
      },
    };
    const deltaEvent = {
      type: "content_block_delta" as const,
      index: 1,
      delta: {
        type: "input_json_delta" as const,
        partial_json: '{"query": "Melbourne Austr',
      },
    };

    const start = _makeMessageChunkFromAnthropicEvent(
      startEvent as Parameters<typeof _makeMessageChunkFromAnthropicEvent>[0],
      fields
    )!.chunk;
    const delta = _makeMessageChunkFromAnthropicEvent(
      deltaEvent as Parameters<typeof _makeMessageChunkFromAnthropicEvent>[0],
      fields
    )!.chunk;

    const serverToolCall = start
      .concat(delta)
      .contentBlocks.find((block) => block.type === "server_tool_call");

    expect(serverToolCall).toMatchObject({
      id: "srvtoolu_01",
      name: "web_search",
      args: '{"query": "Melbourne Austr',
    });
  });

  test("parses streamed server tool args after JSON is complete", () => {
    const startEvent = {
      type: "content_block_start" as const,
      index: 1,
      content_block: {
        type: "server_tool_use" as const,
        id: "srvtoolu_01",
        name: "web_search",
        input: "",
      },
    };
    const deltaEvent = {
      type: "content_block_delta" as const,
      index: 1,
      delta: {
        type: "input_json_delta" as const,
        partial_json: '{"query": "Melbourne Australia news today"}',
      },
    };

    const start = _makeMessageChunkFromAnthropicEvent(
      startEvent as Parameters<typeof _makeMessageChunkFromAnthropicEvent>[0],
      fields
    )!.chunk;
    const delta = _makeMessageChunkFromAnthropicEvent(
      deltaEvent as Parameters<typeof _makeMessageChunkFromAnthropicEvent>[0],
      fields
    )!.chunk;

    const serverToolCall = start
      .concat(delta)
      .contentBlocks.find((block) => block.type === "server_tool_call");

    expect(serverToolCall).toMatchObject({
      id: "srvtoolu_01",
      name: "web_search",
      args: { query: "Melbourne Australia news today" },
    });
  });

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
});
