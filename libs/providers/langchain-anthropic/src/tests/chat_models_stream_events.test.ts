import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatModelStream } from "../../../../langchain-core/src/language_models/stream.js";
import { ChatAnthropic } from "../chat_models.js";
import type { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";

/**
 * Builds a mock Anthropic that returns a canned SSE stream.
 * We subclass ChatAnthropic and override createStreamWithRetry
 * to return a fake async iterable of Anthropic events.
 */
class MockStreamChatAnthropic extends ChatAnthropic {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  private mockEvents: any[];

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(mockEvents: any[]) {
    super({ apiKey: "fake-key", model: "claude-sonnet-4-20250514" });
    this.mockEvents = mockEvents;
  }

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  protected async createStreamWithRetry(): Promise<any> {
    const events = this.mockEvents;
    return {
      controller: { abort: () => {} },
      async *[Symbol.asyncIterator]() {
        for (const event of events) {
          yield event;
        }
      },
    };
  }
}

// ─── Fixtures (native Anthropic SSE events) ─────────────────────

function textOnlyEvents() {
  return [
    {
      type: "message_start" as const,
      message: {
        id: "msg_01ABC",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-sonnet-4-20250514",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 25, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "text" as const, text: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: "Hello" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: " world" },
    },
    { type: "content_block_stop" as const, index: 0 },
    {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 2 },
    },
    { type: "message_stop" as const },
  ];
}

function thinkingPlusTextEvents() {
  return [
    {
      type: "message_start" as const,
      message: {
        id: "msg_02DEF",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-sonnet-4-20250514",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "thinking" as const, thinking: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "thinking_delta" as const, thinking: "Let me" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "thinking_delta" as const, thinking: " reason..." },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "signature_delta" as const, signature: "sig_abc" },
    },
    { type: "content_block_stop" as const, index: 0 },
    {
      type: "content_block_start" as const,
      index: 1,
      content_block: { type: "text" as const, text: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 1,
      delta: { type: "text_delta" as const, text: "The answer is 42." },
    },
    { type: "content_block_stop" as const, index: 1 },
    {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 20 },
    },
    { type: "message_stop" as const },
  ];
}

function toolCallEvents() {
  return [
    {
      type: "message_start" as const,
      message: {
        id: "msg_03GHI",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-sonnet-4-20250514",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "text" as const, text: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: "Let me search." },
    },
    { type: "content_block_stop" as const, index: 0 },
    {
      type: "content_block_start" as const,
      index: 1,
      content_block: {
        type: "tool_use" as const,
        id: "toolu_01ABC",
        name: "web_search",
      },
    },
    {
      type: "content_block_delta" as const,
      index: 1,
      delta: { type: "input_json_delta" as const, partial_json: '{"query"' },
    },
    {
      type: "content_block_delta" as const,
      index: 1,
      delta: { type: "input_json_delta" as const, partial_json: ':"weather"}' },
    },
    { type: "content_block_stop" as const, index: 1 },
    {
      type: "message_delta" as const,
      delta: { stop_reason: "tool_use" as const, stop_sequence: null },
      usage: { output_tokens: 15 },
    },
    { type: "message_stop" as const },
  ];
}

function cacheUsageEvents() {
  return [
    {
      type: "message_start" as const,
      message: {
        id: "msg_04JKL",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-sonnet-4-20250514",
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 0,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 200,
        },
      },
    },
    {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "text" as const, text: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: "Cached response" },
    },
    { type: "content_block_stop" as const, index: 0 },
    {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: { output_tokens: 3 },
    },
    { type: "message_stop" as const },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────

describe("ChatAnthropic._streamChatModelEvents (native)", () => {
  describe("text-only streaming", () => {
    test("emits correct lifecycle events", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];

      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const types = events.map((e) => e.type);
      expect(types).toContain("message-start");
      expect(types).toContain("content-block-start");
      expect(types).toContain("content-block-delta");
      expect(types).toContain("content-block-finish");
      expect(types).toContain("message-finish");
    });

    test("message-start carries id and usage", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const start = events.find((e) => e.type === "message-start");
      expect(start).toBeDefined();
      expect((start as { id?: string }).id).toBe("msg_01ABC");
      expect(
        (start as { usage?: { input_tokens: number } }).usage?.input_tokens
      ).toBe(25);
    });

    test("text deltas accumulate correctly", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const deltas = events.filter(
        (e) => e.type === "content-block-delta" && "index" in e && e.index === 0
      );
      expect(deltas.length).toBe(2);

      // First delta: incremental "Hello"
      const d1 = deltas[0] as {
        content: { type: string; text?: string };
      };
      expect(d1.content.type).toBe("text");
      expect(d1.content.text).toBe("Hello");

      // Second delta: incremental " world"
      const d2 = deltas[1] as {
        content: { type: string; text?: string };
      };
      expect(d2.content.type).toBe("text");
      expect(d2.content.text).toBe(" world");
    });

    test("content-block-finish carries finalized text", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find(
        (e) =>
          e.type === "content-block-finish" && "index" in e && e.index === 0
      ) as { content: { type: string; text: string } };
      expect(finish).toBeDefined();
      expect(finish.content.type).toBe("text");
      expect(finish.content.text).toBe("Hello world");
    });

    test("message-finish carries stop reason", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find((e) => e.type === "message-finish") as {
        reason: string;
      };
      expect(finish.reason).toBe("stop");
    });
  });

  describe("thinking + text streaming", () => {
    test("reasoning block accumulates correctly", async () => {
      const model = new MockStreamChatAnthropic(thinkingPlusTextEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      // Reasoning deltas
      const reasoningDeltas = events.filter(
        (e) =>
          e.type === "content-block-delta" &&
          "index" in e &&
          e.index === 0 &&
          "content" in e &&
          (e.content as { type: string }).type === "reasoning" &&
          "reasoning" in e.content
      );
      expect(reasoningDeltas.length).toBe(2);

      const rd1 = reasoningDeltas[0] as {
        content: { type: string; reasoning: string };
      };
      expect(rd1.content.reasoning).toBe("Let me");

      const rd2 = reasoningDeltas[1] as {
        content: { type: string; reasoning: string };
      };
      expect(rd2.content.reasoning).toBe(" reason...");

      // Reasoning finish
      const reasoningFinish = events.find(
        (e) =>
          e.type === "content-block-finish" && "index" in e && e.index === 0
      ) as { content: { type: string; reasoning: string } };
      expect(reasoningFinish.content.type).toBe("reasoning");
      expect(reasoningFinish.content.reasoning).toBe("Let me reason...");
    });

    test("text block follows reasoning with correct index", async () => {
      const model = new MockStreamChatAnthropic(thinkingPlusTextEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const textFinish = events.find(
        (e) =>
          e.type === "content-block-finish" && "index" in e && e.index === 1
      ) as { content: { type: string; text: string } };
      expect(textFinish.content.type).toBe("text");
      expect(textFinish.content.text).toBe("The answer is 42.");
    });

    test("signature delta is handled as non_standard", async () => {
      const model = new MockStreamChatAnthropic(thinkingPlusTextEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      // Signature delta should be emitted as a content block update
      const sigDelta = events.find(
        (e) =>
          e.type === "content-block-delta" &&
          "content" in e &&
          (e.content as { signature?: string }).signature === "sig_abc"
      ) as { content: { type: string; signature?: string } };
      expect(sigDelta).toBeDefined();
      expect(sigDelta.content.signature).toBe("sig_abc");
    });
  });

  describe("tool call streaming", () => {
    test("tool call args accumulate correctly", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      // Start event for tool call
      const toolStart = events.find(
        (e) => e.type === "content-block-start" && "index" in e && e.index === 1
      ) as { content: { type: string; name: string; id: string } };
      expect(toolStart.content.type).toBe("tool_call_chunk");
      expect(toolStart.content.name).toBe("web_search");
      expect(toolStart.content.id).toBe("toolu_01ABC");

      // Deltas carry incremental tool_call_chunk content
      const toolDeltas = events.filter(
        (e) => e.type === "content-block-delta" && "index" in e && e.index === 1
      );
      expect(toolDeltas.length).toBe(2);

      const td1 = toolDeltas[0] as {
        content: { type: string; args?: string };
      };
      expect(td1.content.type).toBe("tool_call_chunk");
      expect(td1.content.args).toBe('{"query"');

      const td2 = toolDeltas[1] as {
        content: { type: string; args?: string };
      };
      expect(td2.content.type).toBe("tool_call_chunk");
      expect(td2.content.args).toBe(':"weather"}');
    });

    test("tool call finish has parsed args", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const toolFinish = events.find(
        (e) =>
          e.type === "content-block-finish" && "index" in e && e.index === 1
      ) as {
        content: {
          type: string;
          name: string;
          id: string;
          args: unknown;
        };
      };
      expect(toolFinish.content.type).toBe("tool_call");
      expect(toolFinish.content.name).toBe("web_search");
      expect(toolFinish.content.id).toBe("toolu_01ABC");
      expect(toolFinish.content.args).toEqual({ query: "weather" });
    });

    test("message-finish has tool_use reason", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find((e) => e.type === "message-finish") as {
        reason: string;
      };
      expect(finish.reason).toBe("tool_use");
    });
  });

  describe("usage streaming", () => {
    test("usage snapshot with cache details", async () => {
      const model = new MockStreamChatAnthropic(cacheUsageEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      // message-start should have input usage with cache details
      const start = events.find((e) => e.type === "message-start") as {
        usage: {
          input_tokens: number;
          input_token_details: {
            cache_creation: number;
            cache_read: number;
          };
        };
      };
      // 100 + 500 + 200 = 800
      expect(start.usage.input_tokens).toBe(800);
      expect(start.usage.input_token_details.cache_creation).toBe(500);
      expect(start.usage.input_token_details.cache_read).toBe(200);
    });

    test("usage event emitted on message_delta", async () => {
      const model = new MockStreamChatAnthropic(cacheUsageEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const usageEvents = events.filter((e) => e.type === "usage");
      expect(usageEvents.length).toBeGreaterThanOrEqual(1);

      // Last usage should include output tokens
      const lastUsage = usageEvents[usageEvents.length - 1] as {
        usage: { output_tokens: number };
      };
      expect(lastUsage.usage.output_tokens).toBe(3);
    });

    test("message-finish carries final usage", async () => {
      const model = new MockStreamChatAnthropic(cacheUsageEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const finish = events.find((e) => e.type === "message-finish") as {
        usage: { input_tokens: number; output_tokens: number };
      };
      expect(finish.usage.input_tokens).toBe(800);
      expect(finish.usage.output_tokens).toBe(3);
    });

    test("no usage events when streamUsage is false", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      // Override streamUsage on the model
      model.streamUsage = false;
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: false,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const usageEvents = events.filter((e) => e.type === "usage");
      expect(usageEvents.length).toBe(0);

      // message-start and message-finish should not have usage
      const start = events.find((e) => e.type === "message-start") as {
        usage?: unknown;
      };
      expect(start.usage).toBeUndefined();
    });
  });

  describe("provider passthrough", () => {
    test("message_start metadata is forwarded as provider event", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const providerEvents = events.filter((e) => e.type === "provider");
      const metaEvent = providerEvents.find(
        (e) => (e as { name: string }).name === "message_start"
      ) as { provider: string; payload: { model: string; id: string } };
      expect(metaEvent).toBeDefined();
      expect(metaEvent.provider).toBe("anthropic");
      expect(metaEvent.payload.model).toBe("claude-sonnet-4-20250514");
      expect(metaEvent.payload.id).toBe("msg_01ABC");
    });

    test("unknown events are forwarded as provider events", async () => {
      const eventsWithPing = [
        ...textOnlyEvents().slice(0, -1), // everything except message_stop
        { type: "ping" as const },
        textOnlyEvents().slice(-1)[0], // message_stop
      ];
      const model = new MockStreamChatAnthropic(eventsWithPing);
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const pingEvent = events.find(
        (e) => e.type === "provider" && (e as { name: string }).name === "ping"
      );
      expect(pingEvent).toBeDefined();
    });
  });

  describe("integration with ChatModelStream", () => {
    test("text sub-stream works end-to-end", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const text = await stream.text;
      expect(text).toBe("Hello world");
    });

    test("toolCalls sub-stream works end-to-end", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const calls = await stream.toolCalls;
      expect(calls.length).toBe(1);
      expect(calls[0]!.name).toBe("web_search");
      expect(calls[0]!.args).toEqual({ query: "weather" });
    });

    test("reasoning sub-stream works end-to-end", async () => {
      const model = new MockStreamChatAnthropic(thinkingPlusTextEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const reasoning = await stream.reasoning;
      expect(reasoning).toBe("Let me reason...");
    });

    test("output assembles correct AIMessage", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const message = await stream.output;

      expect(message.id).toBe("msg_03GHI");
      expect(message._getType()).toBe("ai");

      const content = message.content as Array<{
        type: string;
        text?: string;
        name?: string;
        args?: unknown;
      }>;

      // Text block + tool call block
      expect(content.length).toBe(2);
      expect(content[0]!.type).toBe("text");
      expect(content[0]!.text).toBe("Let me search.");
      expect(content[1]!.type).toBe("tool_call");
      expect(content[1]!.name).toBe("web_search");
      expect(content[1]!.args).toEqual({ query: "weather" });

      // Tool calls array
      expect(message.tool_calls?.length).toBe(1);
      expect(message.tool_calls?.[0]?.name).toBe("web_search");
    });

    test("usage sub-stream works end-to-end", async () => {
      const model = new MockStreamChatAnthropic(cacheUsageEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {
          streamUsage: true,
        } as BaseChatModelCallOptions)
      );
      const usage = await stream.usage;
      expect(usage?.input_tokens).toBe(800);
      expect(usage?.output_tokens).toBe(3);
    });

    test("await stream returns AIMessage directly", async () => {
      const model = new MockStreamChatAnthropic(textOnlyEvents());
      const message = await new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      expect(message._getType()).toBe("ai");
      expect(message.id).toBe("msg_01ABC");
    });

    test("sequential sub-stream consumption", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );

      // Sequential consumption works reliably.
      // Parallel consumption with Promise.all has a known microtask
      // scheduling edge case with synchronous async generators that
      // will be addressed separately.
      const text = await stream.text;
      expect(text).toBe("Let me search.");

      const tools = await stream.toolCalls;
      expect(tools.length).toBe(1);
      expect(tools[0]!.name).toBe("web_search");
    });

    test("parallel sub-stream consumption from events", async () => {
      const model = new MockStreamChatAnthropic(toolCallEvents());

      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      async function* replay() {
        for (const e of events) yield e;
      }
      const stream = new ChatModelStream(replay());

      const [text, tools] = await Promise.all([stream.text, stream.toolCalls]);

      expect(text).toBe("Let me search.");
      expect(tools.length).toBe(1);
      expect(tools[0]!.name).toBe("web_search");
    });
  });
});
