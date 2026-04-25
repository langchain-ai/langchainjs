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
      event: "message-start",
      id: "msg_123",
      usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 },
    };
    expect(event.event).toBe("message-start");
    expect(event.id).toBe("msg_123");
    expect(event.usage?.input_tokens).toBe(100);
  });

  test("MessageStartEvent without optional fields", () => {
    const event: MessageStartEvent = { event: "message-start" };
    expect(event.event).toBe("message-start");
    expect(event.id).toBeUndefined();
    expect(event.usage).toBeUndefined();
  });

  test("MessageFinishEvent", () => {
    const event: MessageFinishEvent = {
      event: "message-finish",
      reason: "stop",
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      metadata: { model_name: "gpt-4" },
    };
    expect(event.event).toBe("message-finish");
    expect(event.reason).toBe("stop");
    expect(event.usage?.output_tokens).toBe(50);
    expect(event.metadata?.model_name).toBe("gpt-4");
  });

  test("ContentBlockStartEvent", () => {
    const event: ContentBlockStartEvent = {
      event: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    };
    expect(event.event).toBe("content-block-start");
    expect(event.index).toBe(0);
    expect(event.content.type).toBe("text");
  });

  test("ContentBlockDeltaEvent with text-delta", () => {
    const event: ContentBlockDeltaEvent = {
      event: "content-block-delta",
      index: 0,
      content: { type: "text", text: " world" },
    };
    expect(event.event).toBe("content-block-delta");
    expect(event.index).toBe(0);
    expect(event.content.type).toBe("text");
    if (event.content.type === "text") {
      expect(event.content.text).toBe(" world");
    }
  });

  test("ContentBlockDeltaEvent with tool call block-delta", () => {
    const event: ContentBlockDeltaEvent = {
      event: "content-block-delta",
      index: 1,
      content: {
        type: "tool_call_chunk",
        id: "call_1",
        name: "search",
        args: '{"q":"wea',
      },
    };
    expect(event.event).toBe("content-block-delta");
    expect(event.content.type).toBe("tool_call_chunk");
  });

  test("ContentBlockDeltaEvent with reasoning-delta", () => {
    const event: ContentBlockDeltaEvent = {
      event: "content-block-delta",
      index: 0,
      content: { type: "reasoning", reasoning: "Let me think" },
    };
    expect(event.content.type).toBe("reasoning");
    if (event.content.type === "reasoning") {
      expect(event.content.reasoning).toBe("Let me think");
    }
  });

  test("ContentBlockDeltaEvent with content block delta", () => {
    const event: ContentBlockDeltaEvent = {
      event: "content-block-delta",
      index: 0,
      content: { type: "reasoning", signature: "sig_abc" },
    };
    expect(event.content.type).toBe("reasoning");
  });

  test("ContentBlockFinishEvent with text", () => {
    const event: ContentBlockFinishEvent = {
      event: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    };
    expect(event.event).toBe("content-block-finish");
    expect(event.content.type).toBe("text");
  });

  test("ContentBlockFinishEvent with finalized tool call", () => {
    const event: ContentBlockFinishEvent = {
      event: "content-block-finish",
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
      event: "usage",
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125 },
    };
    expect(event.event).toBe("usage");
    expect(event.usage.total_tokens).toBe(125);
  });

  test("ProviderEvent", () => {
    const event: ProviderEvent = {
      event: "provider",
      provider: "openai",
      name: "response.web_search_call.searching",
      payload: { item_id: "ws_123", output_index: 0 },
    };
    expect(event.event).toBe("provider");
    expect(event.provider).toBe("openai");
  });

  test("StreamErrorEvent", () => {
    const event: StreamErrorEvent = {
      event: "error",
      message: "Connection lost",
      code: "CONNECTION_ERROR",
    };
    expect(event.event).toBe("error");
    expect(event.message).toBe("Connection lost");
  });

  test("event types are mutually exclusive via event field", () => {
    const events: ChatModelStreamEvent[] = [
      { event: "message-start" },
      { event: "message-finish", reason: "stop" },
      {
        event: "content-block-start",
        index: 0,
        content: { type: "text", text: "" },
      },
      {
        event: "content-block-delta",
        index: 0,
        content: { type: "text", text: "hi" },
      },
      {
        event: "content-block-finish",
        index: 0,
        content: { type: "text", text: "hi" },
      },
      {
        event: "usage",
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      },
      { event: "provider", provider: "test", name: "test.event", payload: {} },
      { event: "error", message: "oops" },
    ];

    const expectedEvents = [
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
      expect(events[i]!.event).toBe(expectedEvents[i]);
    }
  });
});

describe("interleaving semantics", () => {
  test("interleaved content blocks have distinct indexes", () => {
    const events: ChatModelStreamEvent[] = [
      { event: "message-start" },
      {
        event: "content-block-start",
        index: 0,
        content: { type: "text", text: "" },
      },
      {
        event: "content-block-start",
        index: 1,
        content: {
          type: "tool_call_chunk",
          id: "c1",
          name: "search",
          args: "",
        },
      },
      {
        event: "content-block-delta",
        index: 0,
        content: { type: "text", text: "Hello" },
      },
      {
        event: "content-block-delta",
        index: 1,
        content: { type: "tool_call_chunk", args: '{"q"' },
      },
      {
        event: "content-block-delta",
        index: 0,
        content: { type: "text", text: " world" },
      },
      {
        event: "content-block-finish",
        index: 0,
        content: { type: "text", text: "Hello world" },
      },
      {
        event: "content-block-delta",
        index: 1,
        content: { type: "tool_call_chunk", args: '{"q":"test"}' },
      },
      {
        event: "content-block-finish",
        index: 1,
        content: {
          type: "tool_call",
          id: "c1",
          name: "search",
          args: { q: "test" },
        },
      },
      { event: "message-finish", reason: "tool_use" },
    ];

    const blockStates = new Map<number, "started" | "streaming" | "finished">();
    for (const event of events) {
      if (event.event === "content-block-start") {
        expect(blockStates.has(event.index)).toBe(false);
        blockStates.set(event.index, "started");
      } else if (event.event === "content-block-delta") {
        const state = blockStates.get(event.index);
        expect(state === "started" || state === "streaming").toBe(true);
        blockStates.set(event.index, "streaming");
      } else if (event.event === "content-block-finish") {
        const state = blockStates.get(event.index);
        expect(state === "started" || state === "streaming").toBe(true);
        blockStates.set(event.index, "finished");
      }
    }

    expect(blockStates.get(0)).toBe("finished");
    expect(blockStates.get(1)).toBe("finished");
  });
});
