import { describe, test, expect } from "vitest";
import type {
  ChatModelStreamEvent,
  MessageStartEvent,
  MessageFinishEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockFinishEvent,
  UsageUpdateEvent,
  ProviderEvent,
  StreamErrorEvent,
} from "../event.js";

describe("ChatModelStreamEvent types", () => {
  test("MessageStartEvent", () => {
    const event: MessageStartEvent = {
      type: "message-start",
      id: "msg_123",
      usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 },
    };
    expect(event.type).toBe("message-start");
    expect(event.id).toBe("msg_123");
    expect(event.usage?.input_tokens).toBe(100);
  });

  test("MessageStartEvent without optional fields", () => {
    const event: MessageStartEvent = { type: "message-start" };
    expect(event.type).toBe("message-start");
    expect(event.id).toBeUndefined();
    expect(event.usage).toBeUndefined();
  });

  test("MessageFinishEvent", () => {
    const event: MessageFinishEvent = {
      type: "message-finish",
      reason: "stop",
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      responseMetadata: { model_name: "gpt-4" },
    };
    expect(event.type).toBe("message-finish");
    expect(event.reason).toBe("stop");
    expect(event.usage?.output_tokens).toBe(50);
    expect(event.responseMetadata?.model_name).toBe("gpt-4");
  });

  test("ContentBlockStartEvent", () => {
    const event: ContentBlockStartEvent = {
      type: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    };
    expect(event.type).toBe("content-block-start");
    expect(event.index).toBe(0);
    expect(event.content.type).toBe("text");
  });

  test("ContentBlockDeltaEvent with text-delta", () => {
    const event: ContentBlockDeltaEvent = {
      type: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: " world" },
    };
    expect(event.type).toBe("content-block-delta");
    expect(event.index).toBe(0);
    expect(event.delta.type).toBe("text-delta");
    if (event.delta.type === "text-delta") {
      expect(event.delta.text).toBe(" world");
    }
  });

  test("ContentBlockDeltaEvent with tool-call-delta", () => {
    const event: ContentBlockDeltaEvent = {
      type: "content-block-delta",
      index: 1,
      delta: {
        type: "tool-call-delta",
        id: "call_1",
        name: "search",
        args: '{"q":"wea',
      },
    };
    expect(event.type).toBe("content-block-delta");
    expect(event.delta.type).toBe("tool-call-delta");
    if (event.delta.type === "tool-call-delta") {
      expect(event.delta.name).toBe("search");
      expect(event.delta.args).toBe('{"q":"wea');
    }
  });

  test("ContentBlockDeltaEvent with reasoning-delta", () => {
    const event: ContentBlockDeltaEvent = {
      type: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: "Let me think" },
    };
    expect(event.delta.type).toBe("reasoning-delta");
    if (event.delta.type === "reasoning-delta") {
      expect(event.delta.reasoning).toBe("Let me think");
    }
  });

  test("ContentBlockDeltaEvent with block-delta", () => {
    const event: ContentBlockDeltaEvent = {
      type: "content-block-delta",
      index: 0,
      delta: {
        type: "block-delta",
        content: { type: "reasoning", signature: "sig_abc" },
      },
    };
    expect(event.delta.type).toBe("block-delta");
    if (event.delta.type === "block-delta") {
      expect(event.delta.content.type).toBe("reasoning");
    }
  });

  test("ContentBlockFinishEvent with text", () => {
    const event: ContentBlockFinishEvent = {
      type: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    };
    expect(event.type).toBe("content-block-finish");
    expect(event.content.type).toBe("text");
  });

  test("ContentBlockFinishEvent with finalized tool call", () => {
    const event: ContentBlockFinishEvent = {
      type: "content-block-finish",
      index: 1,
      content: {
        type: "tool_call",
        id: "call_1",
        name: "search",
        args: { q: "weather" },
      },
    };
    expect(event.content.type).toBe("tool_call");
  });

  test("UsageUpdateEvent", () => {
    const event: UsageUpdateEvent = {
      type: "usage",
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125 },
    };
    expect(event.type).toBe("usage");
    expect(event.usage.total_tokens).toBe(125);
  });

  test("ProviderEvent", () => {
    const event: ProviderEvent = {
      type: "provider",
      provider: "openai",
      name: "response.web_search_call.searching",
      payload: { item_id: "ws_123", output_index: 0 },
    };
    expect(event.type).toBe("provider");
    expect(event.provider).toBe("openai");
  });

  test("StreamErrorEvent", () => {
    const event: StreamErrorEvent = {
      type: "error",
      message: "Connection lost",
      code: "CONNECTION_ERROR",
    };
    expect(event.type).toBe("error");
    expect(event.message).toBe("Connection lost");
  });

  test("event types are mutually exclusive via type field", () => {
    const events: ChatModelStreamEvent[] = [
      { type: "message-start" },
      { type: "message-finish", reason: "stop" },
      {
        type: "content-block-start",
        index: 0,
        content: { type: "text", text: "" },
      },
      {
        type: "content-block-delta",
        index: 0,
        delta: { type: "text-delta", text: "hi" },
      },
      {
        type: "content-block-finish",
        index: 0,
        content: { type: "text", text: "hi" },
      },
      {
        type: "usage",
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      },
      { type: "provider", provider: "test", name: "test.event", payload: {} },
      { type: "error", message: "oops" },
    ];

    const expectedTypes = [
      "message-start",
      "message-finish",
      "content-block-start",
      "content-block-delta",
      "content-block-finish",
      "usage",
      "provider",
      "error",
    ];

    for (let i = 0; i < events.length; i++) {
      expect(events[i]!.type).toBe(expectedTypes[i]);
    }
  });
});

describe("interleaving semantics", () => {
  test("interleaved content blocks have distinct indexes", () => {
    const events: ChatModelStreamEvent[] = [
      { type: "message-start" },
      {
        type: "content-block-start",
        index: 0,
        content: { type: "text", text: "" },
      },
      {
        type: "content-block-start",
        index: 1,
        content: {
          type: "tool_call_chunk",
          id: "c1",
          name: "search",
          args: "",
        },
      },
      {
        type: "content-block-delta",
        index: 0,
        delta: { type: "text-delta", text: "Hello" },
      },
      {
        type: "content-block-delta",
        index: 1,
        delta: { type: "tool-call-delta", args: '{"q"' },
      },
      {
        type: "content-block-delta",
        index: 0,
        delta: { type: "text-delta", text: " world" },
      },
      {
        type: "content-block-finish",
        index: 0,
        content: { type: "text", text: "Hello world" },
      },
      {
        type: "content-block-delta",
        index: 1,
        delta: { type: "tool-call-delta", args: ':"test"}' },
      },
      {
        type: "content-block-finish",
        index: 1,
        content: {
          type: "tool_call",
          id: "c1",
          name: "search",
          args: { q: "test" },
        },
      },
      { type: "message-finish", reason: "tool_use" },
    ];

    const blockStates = new Map<number, "started" | "streaming" | "finished">();
    for (const event of events) {
      if (event.type === "content-block-start") {
        expect(blockStates.has(event.index)).toBe(false);
        blockStates.set(event.index, "started");
      } else if (event.type === "content-block-delta") {
        const state = blockStates.get(event.index);
        expect(state === "started" || state === "streaming").toBe(true);
        blockStates.set(event.index, "streaming");
      } else if (event.type === "content-block-finish") {
        const state = blockStates.get(event.index);
        expect(state === "started" || state === "streaming").toBe(true);
        blockStates.set(event.index, "finished");
      }
    }

    expect(blockStates.get(0)).toBe("finished");
    expect(blockStates.get(1)).toBe("finished");
  });
});
