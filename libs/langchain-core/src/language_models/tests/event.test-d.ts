import { describe, it, assertType, expectTypeOf } from "vitest";
import type {
  BlockDelta,
  ChatModelStreamEvent,
  ContentBlockDelta,
  ContentBlockDeltaEvent,
  ContentBlockFinishEvent,
  ContentBlockStartEvent,
  DataDelta,
  MessageFinishEvent,
  MessageStartEvent,
  ProviderEvent,
  ReasoningDelta,
  StreamErrorEvent,
  TextDelta,
  ToolCallDelta,
  UsageUpdateEvent,
} from "../event.js";

describe("ChatModelStreamEvent", () => {
  it("narrows by its event field", () => {
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "message-start" }>
    >().toEqualTypeOf<MessageStartEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "message-finish" }>
    >().toEqualTypeOf<MessageFinishEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "content-block-start" }>
    >().toEqualTypeOf<ContentBlockStartEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "content-block-delta" }>
    >().toEqualTypeOf<ContentBlockDeltaEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "content-block-finish" }>
    >().toEqualTypeOf<ContentBlockFinishEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "usage" }>
    >().toEqualTypeOf<UsageUpdateEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "provider" }>
    >().toEqualTypeOf<ProviderEvent>();
    expectTypeOf<
      Extract<ChatModelStreamEvent, { event: "error" }>
    >().toEqualTypeOf<StreamErrorEvent>();
  });

  it("accepts a message start, with or without its optional fields", () => {
    assertType<MessageStartEvent>({
      event: "message-start",
      id: "msg_123",
      usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 },
    });
    assertType<MessageStartEvent>({ event: "message-start" });
  });

  it("accepts a message finish", () => {
    assertType<MessageFinishEvent>({
      event: "message-finish",
      reason: "stop",
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      responseMetadata: { model_name: "gpt-4" },
    });
  });

  it("accepts a content block start", () => {
    assertType<ContentBlockStartEvent>({
      event: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    });
  });

  it("accepts a content block finish with text or a finalized tool call", () => {
    assertType<ContentBlockFinishEvent>({
      event: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    });
    assertType<ContentBlockFinishEvent>({
      event: "content-block-finish",
      index: 1,
      content: {
        type: "tool_call",
        id: "call_1",
        name: "search",
        args: { q: "weather" },
      },
    });
  });

  it("accepts a usage update", () => {
    assertType<UsageUpdateEvent>({
      event: "usage",
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125 },
    });
  });

  it("accepts a provider event", () => {
    assertType<ProviderEvent>({
      event: "provider",
      provider: "openai",
      name: "response.web_search_call.searching",
      payload: { item_id: "ws_123", output_index: 0 },
    });
  });

  it("accepts a stream error", () => {
    assertType<StreamErrorEvent>({
      event: "error",
      message: "Connection lost",
      code: "CONNECTION_ERROR",
    });
  });
});

describe("ContentBlockDelta", () => {
  it("narrows by its type field", () => {
    expectTypeOf<
      Extract<ContentBlockDelta, { type: "text-delta" }>
    >().toEqualTypeOf<TextDelta>();
    expectTypeOf<
      Extract<ContentBlockDelta, { type: "reasoning-delta" }>
    >().toEqualTypeOf<ReasoningDelta>();
    expectTypeOf<
      Extract<ContentBlockDelta, { type: "data-delta" }>
    >().toEqualTypeOf<DataDelta>();
    expectTypeOf<
      Extract<ContentBlockDelta, { type: "tool-call-delta" }>
    >().toEqualTypeOf<ToolCallDelta>();
    expectTypeOf<
      Extract<ContentBlockDelta, { type: "block-delta" }>
    >().toEqualTypeOf<BlockDelta>();
  });

  it("accepts each delta on a content block delta event", () => {
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: " world" },
    });
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: "Let me think" },
    });
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 0,
      delta: { type: "data-delta", data: "UklGR", encoding: "base64" },
    });
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 1,
      delta: { type: "tool-call-delta", args: '"weather"}' },
    });
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 1,
      delta: {
        type: "block-delta",
        fields: {
          type: "tool_call_chunk",
          id: "call_1",
          name: "search",
          args: '{"q":"wea',
        },
      },
    });
    assertType<ContentBlockDeltaEvent>({
      event: "content-block-delta",
      index: 0,
      delta: {
        type: "block-delta",
        fields: { type: "reasoning", signature: "sig_abc" },
      },
    });
  });
});
