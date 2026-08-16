import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "../event.js";
import { ChatModelStream } from "../stream.js";
import type { ContentBlock } from "../../messages/content/index.js";

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
    { event: "message-start", id: "msg_1" },
    {
      event: "content-block-start",
      index: 0,
      content: { type: "text", text: "" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: "Hello" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "text-delta", text: " world" },
    },
    {
      event: "content-block-finish",
      index: 0,
      content: { type: "text", text: "Hello world" },
    },
    {
      event: "usage",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
    },
    {
      event: "message-finish",
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
      event: "message-start",
      id: "msg_2",
      usage: { input_tokens: 50, output_tokens: 0, total_tokens: 50 },
    },
    // Reasoning block
    {
      event: "content-block-start",
      index: 0,
      content: { type: "reasoning", reasoning: "" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: "Let me" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: " think..." },
    },
    {
      event: "content-block-finish",
      index: 0,
      content: { type: "reasoning", reasoning: "Let me think..." },
    },
    // Text block
    {
      event: "content-block-start",
      index: 1,
      content: { type: "text", text: "" },
    },
    {
      event: "content-block-delta",
      index: 1,
      delta: { type: "text-delta", text: "The answer" },
    },
    {
      event: "content-block-delta",
      index: 1,
      delta: { type: "text-delta", text: " is 42." },
    },
    {
      event: "content-block-finish",
      index: 1,
      content: { type: "text", text: "The answer is 42." },
    },
    // Tool call block
    {
      event: "content-block-start",
      index: 2,
      content: {
        type: "tool_call_chunk",
        id: "call_1",
        name: "calculator",
        args: "",
      },
    },
    {
      event: "content-block-delta",
      index: 2,
      delta: {
        type: "block-delta",
        fields: {
          type: "tool_call_chunk",
          id: "call_1",
          name: "calculator",
          args: '{"expr',
        },
      },
    },
    {
      event: "content-block-delta",
      index: 2,
      delta: {
        type: "block-delta",
        fields: {
          type: "tool_call_chunk",
          id: "call_1",
          name: "calculator",
          args: '{"expr":"6*7"}',
        },
      },
    },
    {
      event: "content-block-finish",
      index: 2,
      content: {
        type: "tool_call",
        id: "call_1",
        name: "calculator",
        args: { expr: "6*7" },
      },
    },
    {
      event: "usage",
      usage: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
    },
    {
      event: "message-finish",
      reason: "tool_use",
      usage: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
    },
  ];
}

function providerThinkingStreamEvents(): ChatModelStreamEvent[] {
  return [
    { event: "message-start", id: "msg_thinking" },
    {
      event: "content-block-start",
      index: 0,
      content: { type: "thinking", thinking: "" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: "Let me" },
    },
    {
      event: "content-block-delta",
      index: 0,
      delta: { type: "reasoning-delta", reasoning: " think..." },
    },
    {
      event: "content-block-finish",
      index: 0,
      content: { type: "thinking", thinking: "Let me think..." },
    },
    { event: "message-finish", reason: "stop" },
  ] as unknown as ChatModelStreamEvent[];
}

async function* delayedTextAfterReasoningEvents(
  onMessageFinish: () => void
): AsyncGenerator<ChatModelStreamEvent> {
  yield { event: "message-start", id: "msg_seq" };
  yield {
    event: "content-block-start",
    index: 0,
    content: { type: "reasoning", reasoning: "" },
  };
  yield {
    event: "content-block-delta",
    index: 0,
    delta: { type: "reasoning-delta", reasoning: "Let me think" },
  };
  yield {
    event: "content-block-start",
    index: 1,
    content: { type: "text", text: "" },
  };
  yield {
    event: "content-block-delta",
    index: 1,
    delta: { type: "text-delta", text: "Hello" },
  };
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
  onMessageFinish();
  yield { event: "message-finish", reason: "stop" };
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
      expect(collected[0]!.event).toBe("message-start");
      expect(collected[collected.length - 1]!.event).toBe("message-finish");
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

    test("accepts legacy content-shaped text deltas", async () => {
      const stream = new ChatModelStream(
        iterEvents([
          { event: "message-start", id: "msg_legacy_content_delta" },
          {
            event: "content-block-start",
            index: 0,
            content: { type: "text", text: "" },
          },
          {
            event: "content-block-delta",
            index: 0,
            content: { type: "text", text: "Hello" },
          },
          {
            event: "content-block-delta",
            index: 0,
            content: { type: "text", text: " world" },
          },
          { event: "message-finish", reason: "stop" },
        ] as unknown as ChatModelStreamEvent[])
      );

      await expect(stream.text).resolves.toBe("Hello world");
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

    test("accepts provider thinking deltas as reasoning", async () => {
      const stream = new ChatModelStream(
        iterEvents(providerThinkingStreamEvents())
      );

      expect(await stream.reasoning).toBe("Let me think...");
    });

    test("finishes before message end when text starts after reasoning", async () => {
      let messageFinished = false;
      const stream = new ChatModelStream(
        delayedTextAfterReasoningEvents(() => {
          messageFinished = true;
        })
      );

      expect(await stream.reasoning).toBe("Let me think");
      expect(messageFinished).toBe(false);
      expect(await stream.text).toBe("Hello");
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
        { event: "message-start" },
        { event: "message-finish" },
      ];
      const stream = new ChatModelStream(iterEvents(events));
      const usage = await stream.usage;
      expect(usage).toBeUndefined();
    });

    test("normalizes partial usage snapshots", async () => {
      const events: ChatModelStreamEvent[] = [
        { event: "message-start", usage: { input_tokens: 3 } },
        { event: "message-finish", usage: { output_tokens: 5 } },
      ];
      const stream = new ChatModelStream(iterEvents(events));

      await expect(stream.usage).resolves.toEqual({
        input_tokens: 0,
        output_tokens: 5,
        total_tokens: 0,
      });
      await expect(stream.output).resolves.toMatchObject({
        usage_metadata: {
          input_tokens: 0,
          output_tokens: 5,
          total_tokens: 0,
        },
      });
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

    test("normalizes provider tool-use blocks into tool calls", async () => {
      const stream = new ChatModelStream(
        iterEvents([
          { event: "message-start", id: "msg_provider_tool" },
          {
            event: "content-block-start",
            index: 0,
            content: {
              type: "tool_use",
              id: "toolu_1",
              name: "calculator",
              input: "",
              caller: { type: "direct" },
            } as unknown as ContentBlock,
          },
          {
            event: "content-block-delta",
            index: 0,
            delta: {
              type: "block-delta",
              fields: {
                type: "tool_call_chunk",
                id: "toolu_1",
                name: "calculator",
                args: '{"expression": "12345 + 67890"}',
              },
            },
          },
          {
            event: "content-block-finish",
            index: 0,
            content: {
              type: "input_json_delta",
              id: "toolu_1",
              name: "calculator",
              input: '7890"}',
              args: '{"expression": "12345 + 67890"}',
              caller: { type: "direct" },
            } as unknown as ContentBlock,
          },
          { event: "message-finish", reason: "tool_use" },
        ])
      );

      const message = await stream.output;

      expect(message.tool_calls).toEqual([
        {
          type: "tool_call",
          id: "toolu_1",
          name: "calculator",
          args: { expression: "12345 + 67890" },
        },
      ]);
      expect((message.content as Array<{ type: string }>)[0]?.type).toBe(
        "tool_call"
      );
      expect(message.contentBlocks).toEqual([
        {
          type: "tool_call",
          id: "toolu_1",
          input: '7890"}',
          name: "calculator",
          args: { expression: "12345 + 67890" },
          caller: {
            type: "direct",
          },
        },
      ]);
    });

    test("assembles multimodal data chunks", async () => {
      const stream = new ChatModelStream(
        iterEvents([
          { event: "message-start", id: "msg_audio" },
          {
            event: "content-block-start",
            index: 0,
            content: {
              type: "audio",
              mimeType: "audio/wav",
              data: "",
            },
          },
          {
            event: "content-block-delta",
            index: 0,
            delta: { type: "data-delta", data: "UklG", encoding: "base64" },
          },
          {
            event: "content-block-delta",
            index: 0,
            delta: { type: "data-delta", data: "Rg==" },
          },
          { event: "message-finish", reason: "stop" },
        ])
      );

      const message = await stream.output;
      expect(message.content).toEqual([
        { type: "audio", mimeType: "audio/wav", data: "UklGRg==" },
      ]);
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
        { event: "message-start" },
        {
          event: "provider",
          provider: "openai",
          name: "response.web_search_call.searching",
          payload: { item_id: "ws_1" },
        },
        {
          event: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          event: "content-block-delta",
          index: 0,
          delta: { type: "text-delta", text: "Result" },
        },
        {
          event: "content-block-finish",
          index: 0,
          content: { type: "text", text: "Result" },
        },
        { event: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));

      const providerEvents = [];
      for await (const event of stream) {
        if (event.event === "provider") {
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
        { event: "message-start" },
        {
          event: "provider",
          provider: "openai",
          name: "response.web_search_call.searching",
          payload: {},
        },
        {
          event: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          event: "content-block-delta",
          index: 0,
          delta: { type: "text-delta", text: "Hello" },
        },
        {
          event: "content-block-finish",
          index: 0,
          content: { type: "text", text: "Hello" },
        },
        { event: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));
      const text = await stream.text;
      expect(text).toBe("Hello");
    });
  });

  describe("error handling", () => {
    test("error event in stream", async () => {
      const events: ChatModelStreamEvent[] = [
        { event: "message-start" },
        {
          event: "content-block-start",
          index: 0,
          content: { type: "text", text: "" },
        },
        {
          event: "content-block-delta",
          index: 0,
          delta: { type: "text-delta", text: "Partial" },
        },
        { event: "error", message: "Connection lost", code: "CONN_ERR" },
        { event: "message-finish", reason: "stop" },
      ];

      const stream = new ChatModelStream(iterEvents(events));
      // Error events flow through as regular events
      const collected: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        collected.push(event);
      }
      const errorEvents = collected.filter((e) => e.event === "error");
      expect(errorEvents.length).toBe(1);
    });

    test("source async iterable throwing propagates", async () => {
      async function* throwingSource(): AsyncGenerator<ChatModelStreamEvent> {
        yield { event: "message-start" };
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
