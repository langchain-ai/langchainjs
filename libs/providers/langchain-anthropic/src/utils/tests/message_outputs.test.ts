import { test, expect, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "@langchain/core/messages";
import { _convertMessagesToAnthropicPayload } from "../message_inputs.js";
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

  test("drops empty thinking blocks when replaying streamed content", () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg_01",
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-opus-4-7-20260101",
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 0,
          },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "thinking",
        },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "signature_delta",
          signature: "signature-1",
        },
      },
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "text",
          text: "",
        },
      },
      {
        type: "content_block_delta",
        index: 1,
        delta: {
          type: "text_delta",
          text: "done",
        },
      },
    ];

    let full: AIMessageChunk | undefined;
    for (const event of events) {
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      const result = _makeMessageChunkFromAnthropicEvent(event as any, fields);
      if (result) {
        full = full ? full.concat(result.chunk) : result.chunk;
      }
    }

    expect(full).toBeDefined();
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("hello"),
      full!,
      new HumanMessage("again"),
    ]);
    const assistant = payload.messages.find(
      (message) => message.role === "assistant"
    );

    expect(assistant).toBeDefined();
    expect(Array.isArray(assistant!.content)).toBe(true);
    expect(assistant!.content).toEqual([{ type: "text", text: "done" }]);
  });

  test("preserves complete thinking blocks when replaying messages", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("hello"),
      new AIMessage({
        content: [
          {
            type: "thinking",
            thinking: "reasoned answer",
            signature: "signature-1",
          },
          { type: "text", text: "done" },
        ],
      }),
      new HumanMessage("again"),
    ]);
    const assistant = payload.messages.find(
      (message) => message.role === "assistant"
    );

    expect(assistant).toBeDefined();
    expect(assistant!.content).toEqual([
      {
        type: "thinking",
        thinking: "reasoned answer",
        signature: "signature-1",
      },
      { type: "text", text: "done" },
    ]);
  });
});
