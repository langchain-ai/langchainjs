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

  test("content_block_start with thinking type and no thinking field defaults thinking to empty string", () => {
    // Adaptive thinking on Opus 4.7 can emit a content_block_start with type "thinking"
    // but no `thinking` field. Without the fix, the accumulated block has no `thinking` key
    // and the outbound converter sends a malformed payload that Anthropic rejects with 400.
    const event = {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "thinking" }, // no `thinking` field — adaptive thinking edge case
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();

    const contentBlocks = result!.chunk.content;
    expect(Array.isArray(contentBlocks)).toBe(true);
    const block = (
      contentBlocks as Array<{ type: string; thinking?: unknown }>
    )[0];
    expect(block.type).toBe("thinking");
    // thinking must be explicitly set to "" so the accumulated block has the key
    expect(block).toHaveProperty("thinking", "");
  });

  test("content_block_start with thinking type and a thinking field preserves the value", () => {
    const event = {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "thinking", thinking: "Let me reason..." },
    };

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
    expect(result).not.toBeNull();

    const contentBlocks = result!.chunk.content;
    const block = (
      contentBlocks as Array<{ type: string; thinking?: unknown }>
    )[0];
    expect(block.thinking).toBe("Let me reason...");
  });
});
