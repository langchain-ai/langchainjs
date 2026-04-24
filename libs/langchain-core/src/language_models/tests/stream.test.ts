import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "../event.js";
import { ChatModelStream } from "../stream.js";

// Helper: create an async iterable from an array of events
async function* iterEvents(
  events: ChatModelStreamEvent[]
): AsyncGenerator<ChatModelStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

// Helper: a realistic text-only stream
function textStreamEvents(): ChatModelStreamEvent[] {
  return [
    { type: "message-start", id: "msg_1" },
    {
      type: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    },
    {
      type: "content-block-delta",
      index: 0,
      content: { type: "text", text: "Hello" },
    },
    {
      type: "content-block-delta",
      index: 0,
      content: { type: "text", text: " world" },
    },
    {
      type: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    },
    {
      type: "usage",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
    },
    {
      type: "message-finish",
      reason: "stop",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      responseMetadata: { model_name: "test-model" },
    },
  ];
}

// Helper: a stream with reasoning + text + tool call
function complexStreamEvents(): ChatModelStreamEvent[] {
  return [
    {
      type: "message-start",
      id: "msg_2",
      usage: { input_tokens: 50, output_tokens: 0, total_tokens: 50 },
    },
    // Reasoning block
    {
      type: "content-block-start",
      index: 0,
      content: { type: "reasoning", reasoning: "" },
    },
    {
      type: "content-block-delta",
      index: 0,
      content: { type: "reasoning", reasoning: "Let me" },
    },
    {
      type: "content-block-delta",
      index: 0,
      content: { type: "reasoning", reasoning: " think..." },
    },
    {
      type: "content-block-finish",
      index: 0,
      content: { type: "reasoning", reasoning: "Let me think..." },
    },
    // Text block
    {
      type: "content-block-start",
      index: 1,
      content: { type: "text", text: "" },
    },
    {
      type: "content-block-delta",
      index: 1,
      content: { type: "text", text: "The answer" },
    },
    {
      type: "content-block-delta",
      index: 1,
      content: { type: "text", text: " is 42." },
    },
    {
      type: "content-block-finish",
      index: 1,
      content: { type: "text", text: "The answer is 42." },
    },
    // Tool call block
    {
      type: "content-block-start",
      index: 2,
      content: {
        type: "tool_call_chunk",
        id: "call_1",
        name: "calculator",
        args: "",
      },
    },
    {
      type: "content-block-delta",
      index: 2,
      content: {
        type: "tool_call_chunk",
        id: "call_1",
        name: "calculator",
        args: '{"expr',
      },
    },
    {
      type: "content-block-delta",
      index: 2,
      content: {
        type: "tool_call_chunk",
        id: "call_1",
        name: "calculator",
        args: '":"6*7"}',
      },
    },
    {
      type: "content-block-finish",
      index: 2,
      content: {
        type: "tool_call",
        id: "call_1",
        name: "calculator",
        args: { expr: "6*7" },
      },
    },
    {
      type: "usage",
      usage: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
    },
    {
      type: "message-finish",
      reason: "tool_use",
      usage: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
    },
  ];
}

describe("ChatModelStream", () => {
  describe("raw event iteration", () => {
    test("iterates all events", async () => {
      const events = textStreamEvents();
      const stream = new ChatModelStream(iterEvents(events));

      const collected: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        collected.push(event);
      }

      expect(collected.length).toBe(events.length);
      expect(collected[0]!.type).toBe("message-start");
      expect(collected[collected.length - 1]!.type).toBe("message-finish");
    });
  });

  describe(".text sub-stream", () => {
    test("yields incremental text deltas", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));

      const deltas: string[] = [];
      for await (const delta of stream.text) {
        deltas.push(delta);
      }

      expect(deltas).toEqual(["Hello", " world"]);
    });

    test("await resolves to full text", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));
      const fullText: string = await stream.text;
      expect(fullText).toBe("Hello world");
    });

    test(".full yields running concatenation", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));

      const snapshots: string[] = [];
      for await (const snapshot of stream.text.full) {
        snapshots.push(snapshot);
      }

      expect(snapshots).toEqual(["Hello", "Hello world"]);
    });
  });

  describe(".toolCalls sub-stream", () => {
    test("yields completed tool calls", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));

      const calls = [];
      for await (const call of stream.toolCalls) {
        calls.push(call);
      }

      expect(calls.length).toBe(1);
      expect(calls[0]!.name).toBe("calculator");
      expect(calls[0]!.args).toEqual({ expr: "6*7" });
    });

    test("await resolves to full array", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));
      const calls = await stream.toolCalls;

      expect(calls.length).toBe(1);
      expect(calls[0]!.type).toBe("tool_call");
      expect(calls[0]!.id).toBe("call_1");
    });

    test(".full yields accumulated array", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));

      const snapshots = [];
      for await (const snapshot of stream.toolCalls.full) {
        snapshots.push(snapshot);
      }

      expect(snapshots.length).toBe(1);
      expect(snapshots[0]!.length).toBe(1);
    });
  });

  describe(".reasoning sub-stream", () => {
    test("yields reasoning deltas", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));

      const deltas: string[] = [];
      for await (const delta of stream.reasoning) {
        deltas.push(delta);
      }

      expect(deltas).toEqual(["Let me", " think..."]);
    });

    test("await resolves to full reasoning", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));
      const fullReasoning: string = await stream.reasoning;
      expect(fullReasoning).toBe("Let me think...");
    });
  });

  describe(".usage sub-stream", () => {
    test("yields usage snapshots", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));

      const usages = [];
      for await (const usage of stream.usage) {
        usages.push(usage);
      }

      // message-start usage, then usage event, then message-finish usage
      expect(usages.length).toBe(3);
      // First: input tokens from message-start
      expect(usages[0]!.input_tokens).toBe(50);
      expect(usages[0]!.output_tokens).toBe(0);
      // Last: final usage
      expect(usages[usages.length - 1]!.output_tokens).toBe(30);
    });

    test("await resolves to final usage", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));
      const usage = await stream.usage;
      expect(usage?.input_tokens).toBe(50);
      expect(usage?.output_tokens).toBe(30);
      expect(usage?.total_tokens).toBe(80);
    });

    test("resolves to undefined usage when none provided", async () => {
      const events: ChatModelStreamEvent[] = [
        { type: "message-start" },
        { type: "message-finish" },
      ];
      const stream = new ChatModelStream(iterEvents(events));
      const usage = await stream.usage;
      expect(usage).toBeUndefined();
    });
  });

  describe(".output (AIMessage assembly)", () => {
    test("assembles text-only message", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));
      const message = await stream.output;

      expect(message.id).toBe("msg_1");
      expect(message._getType()).toBe("ai");

      // Content should be the finalized content blocks
      expect(Array.isArray(message.content)).toBe(true);
      const content = message.content as Array<{ type: string; text?: string }>;
      expect(content.length).toBe(1);
      expect(content[0]!.type).toBe("text");
      expect(content[0]!.text).toBe("Hello world");

      // Usage
      expect(message.usage_metadata?.input_tokens).toBe(10);
      expect(message.usage_metadata?.output_tokens).toBe(2);

      // Response metadata
      expect(message.response_metadata?.finish_reason).toBe("stop");
      expect(message.response_metadata?.model_name).toBe("test-model");
    });

    test("assembles complex message with reasoning + text + tool call", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));
      const message = await stream.output;

      expect(message.id).toBe("msg_2");

      const content = message.content as Array<{
        type: string;
        text?: string;
        reasoning?: string;
        name?: string;
        args?: unknown;
      }>;
      expect(content.length).toBe(3);

      // Reasoning
      expect(content[0]!.type).toBe("reasoning");
      expect(content[0]!.reasoning).toBe("Let me think...");

      // Text
      expect(content[1]!.type).toBe("text");
      expect(content[1]!.text).toBe("The answer is 42.");

      // Tool call (finalized)
      expect(content[2]!.type).toBe("tool_call");
      expect(content[2]!.name).toBe("calculator");
      expect(content[2]!.args).toEqual({ expr: "6*7" });

      // Tool calls array
      expect(message.tool_calls?.length).toBe(1);
      expect(message.tool_calls?.[0]?.name).toBe("calculator");

      // Finish reason
      expect(message.response_metadata?.finish_reason).toBe("tool_use");
    });
  });

  describe("PromiseLike (await stream)", () => {
    test("await stream resolves to AIMessage", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));
      const message = await stream;

      expect(message._getType()).toBe("ai");
      expect(message.id).toBe("msg_1");
    });
  });

  describe("replay safety", () => {
    test("multiple sub-streams can be consumed in parallel", async () => {
      const stream = new ChatModelStream(iterEvents(complexStreamEvents()));

      const [text, tools, usage] = await Promise.all([
        stream.text,
        stream.toolCalls,
        stream.usage,
      ]);

      expect(text).toBe("The answer is 42.");
      expect(tools.length).toBe(1);
      expect(tools[0]!.name).toBe("calculator");
      expect(usage?.total_tokens).toBe(80);
    });

    test("iterating raw events then awaiting sub-stream via replay", async () => {
      const stream = new ChatModelStream(iterEvents(textStreamEvents()));

      // First: consume raw events
      const events: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }
      expect(events.length).toBe(7);

      // Then: sub-stream replays from buffer (full replay, not compacted)
      const text = await stream.text;
      expect(text).toBe("Hello world");
    });
  });

  describe("provider events passthrough", () => {
    test("provider events are visible in raw iteration", async () => {
      const events: ChatModelStreamEvent[] = [
        { type: "message-start" },
        {
          type: "provider",
          provider: "openai",
          name: "response.web_search_call.searching",
          payload: { item_id: "ws_1" },
        },
        {
          type: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          type: "content-block-delta",
          index: 0,
          content: { type: "text", text: "Result" },
        },
        {
          type: "content-block-finish",
          index: 0,
          content: { type: "text", text: "Result" },
        },
        { type: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));

      const providerEvents = [];
      for await (const event of stream) {
        if (event.type === "provider") {
          providerEvents.push(event);
        }
      }

      expect(providerEvents.length).toBe(1);
      expect(providerEvents[0]!.provider).toBe("openai");
      expect(providerEvents[0]!.name).toBe(
        "response.web_search_call.searching"
      );
    });

    test("provider events are ignored by sub-streams", async () => {
      const events: ChatModelStreamEvent[] = [
        { type: "message-start" },
        {
          type: "provider",
          provider: "openai",
          name: "response.web_search_call.searching",
          payload: {},
        },
        {
          type: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          type: "content-block-delta",
          index: 0,
          content: { type: "text", text: "Hello" },
        },
        {
          type: "content-block-finish",
          index: 0,
          content: { type: "text", text: "Hello" },
        },
        { type: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));
      const text = await stream.text;
      expect(text).toBe("Hello");
    });
  });

  describe("error handling", () => {
    test("error event in stream", async () => {
      const events: ChatModelStreamEvent[] = [
        { type: "message-start" },
        {
          type: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          type: "content-block-delta",
          index: 0,
          content: { type: "text", text: "Partial" },
        },
        { type: "error", message: "Connection lost", code: "CONN_ERR" },
        { type: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));
      // Error events flow through as regular events
      const collected: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        collected.push(event);
      }
      const errorEvents = collected.filter((e) => e.type === "error");
      expect(errorEvents.length).toBe(1);
    });

    test("source async iterable throwing propagates", async () => {
      async function* throwingSource(): AsyncGenerator<ChatModelStreamEvent> {
        yield { type: "message-start" };
        throw new Error("Provider connection failed");
      }

      const stream = new ChatModelStream(throwingSource());

      await expect(async () => {
        for await (const _event of stream) {
          // consume
        }
      }).rejects.toThrow("Provider connection failed");
    });
  });

  describe("empty stream", () => {
    test("empty source produces empty text", async () => {
      async function* empty(): AsyncGenerator<ChatModelStreamEvent> {
        // nothing
      }
      const stream = new ChatModelStream(empty());
      const text = await stream.text;
      expect(text).toBe("");
    });
  });
});
