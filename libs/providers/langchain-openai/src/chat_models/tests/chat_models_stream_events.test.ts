import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import type { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { OpenAI as OpenAIClient } from "openai";
import { ChatOpenAICompletions } from "../completions.js";

type RawChunk = OpenAIClient.Chat.Completions.ChatCompletionChunk;

class MockStreamChatOpenAICompletions extends ChatOpenAICompletions {
  private mockChunks: RawChunk[];
  capturedRequest:
    | OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
    | undefined;

  constructor(mockChunks: RawChunk[]) {
    super({ apiKey: "fake-key", model: "gpt-4o-mini", streaming: true });
    this.mockChunks = mockChunks;
  }

  override async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
  ): Promise<AsyncIterable<RawChunk>> {
    this.capturedRequest = request;
    const chunks = this.mockChunks;
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  }
}

function textOnlyChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-abc",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Hello" },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-abc",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { content: " world" },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-abc",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: "fp_abc",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    },
  ];
}

function reasoningPlusTextChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-reason",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-5.4",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: "",
            reasoning_content: "Let me",
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-reason",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-5.4",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { reasoning_content: " reason..." },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-reason",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-5.4",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { content: "The answer is 42." },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-reason",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-5.4",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    },
  ];
}

function toolCallChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-tools",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Let me search." },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_abc",
                type: "function",
                function: { name: "web_search", arguments: '{"query"' },
              },
            ],
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: ':"weather"}' },
              },
            ],
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    },
  ];
}

function invalidToolCallChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-bad",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call_bad",
                type: "function",
                function: { name: "broken", arguments: "not-json" },
              },
            ],
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-bad",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    },
  ];
}

function usageChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-usage",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Cached response" },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-usage",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-usage",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 3,
        total_tokens: 103,
        prompt_tokens_details: { cached_tokens: 50, audio_tokens: null },
        completion_tokens_details: {
          reasoning_tokens: 2,
          audio_tokens: null,
        },
      },
    },
  ];
}

function parallelToolCallChunks(): RawChunk[] {
  return [
    {
      id: "chatcmpl-parallel",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "tool_a", arguments: "{}" },
              },
              {
                index: 1,
                id: "call_2",
                type: "function",
                function: { name: "tool_b", arguments: "{}" },
              },
            ],
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    },
    {
      id: "chatcmpl-parallel",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      service_tier: null,
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    },
  ];
}

describe("ChatOpenAICompletions._streamChatModelEvents (native)", () => {
  describe("text-only streaming", () => {
    test("emits correct lifecycle events", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const eventNames = events.map((e) => e.event);
      expect(eventNames).toContain("message-start");
      expect(eventNames).toContain("content-block-start");
      expect(eventNames).toContain("content-block-delta");
      expect(eventNames).toContain("content-block-finish");
      expect(eventNames).toContain("message-finish");
    });

    test("message-start carries id", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const start = events.find((e) => e.event === "message-start");
      expect(start).toBeDefined();
      expect((start as { id?: string }).id).toBe("chatcmpl-abc");
    });

    test("text deltas are incremental", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const textDeltas = events.filter(
        (e) =>
          e.event === "content-block-delta" &&
          "delta" in e &&
          (e.delta as { type: string }).type === "text-delta"
      );
      expect(textDeltas.length).toBe(2);
      expect((textDeltas[0] as { delta: { text: string } }).delta.text).toBe(
        "Hello"
      );
      expect((textDeltas[1] as { delta: { text: string } }).delta.text).toBe(
        " world"
      );
    });

    test("content-block-finish carries finalized text", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      expect(
        events.find((e) => e.event === "content-block-finish")
      ).toMatchObject({
        content: { type: "text", text: "Hello world" },
      });
    });

    test("message-finish carries stop reason", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find((e) => e.event === "message-finish") as {
        reason: string;
      };
      expect(finish.reason).toBe("stop");
    });
  });

  describe("reasoning + text streaming", () => {
    test("reasoning block accumulates correctly", async () => {
      const model = new MockStreamChatOpenAICompletions(
        reasoningPlusTextChunks()
      );
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const reasoningDeltas = events.filter(
        (e) =>
          e.event === "content-block-delta" &&
          "delta" in e &&
          (e.delta as { type: string }).type === "reasoning-delta"
      );
      expect(reasoningDeltas.length).toBe(2);
      expect(
        (reasoningDeltas[0] as { delta: { reasoning: string } }).delta.reasoning
      ).toBe("Let me");
      expect(
        (reasoningDeltas[1] as { delta: { reasoning: string } }).delta.reasoning
      ).toBe(" reason...");

      expect(
        events.find(
          (e) =>
            e.event === "content-block-finish" && e.content.type === "reasoning"
        )
      ).toMatchObject({
        content: { reasoning: "Let me reason..." },
      });
    });

    test("text block uses separate index from reasoning", async () => {
      const model = new MockStreamChatOpenAICompletions(
        reasoningPlusTextChunks()
      );
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      expect(
        events.find(
          (e) => e.event === "content-block-finish" && e.content.type === "text"
        )
      ).toMatchObject({
        content: { text: "The answer is 42." },
      });
    });
  });

  describe("tool call streaming", () => {
    test("tool call args accumulate correctly", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const toolDeltas = events.filter(
        (e) =>
          e.event === "content-block-delta" &&
          "delta" in e &&
          (e.delta as { type: string }).type === "block-delta"
      );
      const toolArgDeltas = toolDeltas.filter(
        (e) =>
          (e as { delta: { fields?: { args?: string } } }).delta.fields?.args !=
          null
      );
      expect(toolArgDeltas.length).toBe(2);
      expect(
        (toolArgDeltas[0] as { delta: { fields: { args: string } } }).delta
          .fields.args
      ).toBe('{"query"');
      expect(
        (toolArgDeltas[1] as { delta: { fields: { args: string } } }).delta
          .fields.args
      ).toBe('{"query":"weather"}');
    });

    test("tool call finish has parsed args", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      expect(
        events.find(
          (e) =>
            e.event === "content-block-finish" && e.content.type === "tool_call"
        )
      ).toMatchObject({
        content: {
          name: "web_search",
          id: "call_abc",
          args: { query: "weather" },
        },
      });
    });

    test("invalid tool call JSON becomes invalid_tool_call", async () => {
      const model = new MockStreamChatOpenAICompletions(
        invalidToolCallChunks()
      );
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      expect(
        events.find(
          (e) =>
            e.event === "content-block-finish" &&
            e.content.type === "invalid_tool_call"
        )
      ).toMatchObject({
        content: {
          name: "broken",
          error: expect.stringContaining("JSON"),
        },
      });
    });

    test("message-finish has tool_use reason", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find((e) => e.event === "message-finish") as {
        reason: string;
      };
      expect(finish.reason).toBe("tool_use");
    });

    test("parallel tool calls get distinct block indices", async () => {
      const model = new MockStreamChatOpenAICompletions(
        parallelToolCallChunks()
      );
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const toolStarts = events.filter(
        (e) =>
          e.event === "content-block-start" &&
          "content" in e &&
          (e.content as { type: string }).type === "tool_call_chunk"
      );
      expect(toolStarts.length).toBe(2);
      const indices = toolStarts.map((e) => (e as { index: number }).index);
      expect(new Set(indices).size).toBe(2);
    });
  });

  describe("usage streaming", () => {
    test("usage snapshot with cache details", async () => {
      const model = new MockStreamChatOpenAICompletions(usageChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const usageEvents = events.filter((e) => e.event === "usage");
      expect(usageEvents.length).toBe(1);

      const usage = (
        usageEvents[0] as {
          usage: {
            input_tokens: number;
            input_token_details: { cache_read: number };
            output_token_details: { reasoning: number };
          };
        }
      ).usage;
      expect(usage.input_tokens).toBe(100);
      expect(usage.input_token_details.cache_read).toBe(50);
      expect(usage.output_token_details.reasoning).toBe(2);
    });

    test("message-finish carries final usage", async () => {
      const model = new MockStreamChatOpenAICompletions(usageChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: true,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      const finish = events.find((e) => e.event === "message-finish") as {
        usage: { total_tokens: number };
      };
      expect(finish.usage.total_tokens).toBe(103);
    });

    test("no usage events when streamUsage is false", async () => {
      const model = new MockStreamChatOpenAICompletions(usageChunks());
      model.streamUsage = false;
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents([], {
        streamUsage: false,
      } as BaseChatModelCallOptions)) {
        events.push(event);
      }

      expect(events.filter((e) => e.event === "usage").length).toBe(0);
      const finish = events.find((e) => e.event === "message-finish") as {
        usage?: unknown;
      };
      expect(finish.usage).toBeUndefined();
    });
  });

  describe("provider passthrough", () => {
    test("stream metadata is forwarded as provider event", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const meta = events.find(
        (e) =>
          e.event === "provider" &&
          (e as { name: string }).name === "stream_metadata"
      ) as { provider: string; payload: { model: string } };
      expect(meta.provider).toBe("openai");
      expect(meta.payload.model).toBe("gpt-4o-mini");
    });
  });

  describe("integration with ChatModelStream", () => {
    test("text sub-stream works end-to-end", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      expect(await stream.text).toBe("Hello world");
    });

    test("toolCalls sub-stream works end-to-end", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const calls = await stream.toolCalls;
      expect(calls.length).toBe(1);
      expect(calls[0]!.name).toBe("web_search");
      expect(calls[0]!.args).toEqual({ query: "weather" });
    });

    test("reasoning sub-stream works end-to-end", async () => {
      const model = new MockStreamChatOpenAICompletions(
        reasoningPlusTextChunks()
      );
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      expect(await stream.reasoning).toBe("Let me reason...");
    });

    test("usage sub-stream works end-to-end", async () => {
      const model = new MockStreamChatOpenAICompletions(usageChunks());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {
          streamUsage: true,
        } as BaseChatModelCallOptions)
      );
      expect(await stream.usage).toMatchObject({
        input_tokens: 100,
        output_tokens: 3,
        total_tokens: 103,
      });
    });

    test("output assembles correct AIMessage", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      const stream = new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      const message = await stream.output;

      expect(message.id).toBe("chatcmpl-tools");
      expect(message._getType()).toBe("ai");

      const content = message.content as Array<{
        type: string;
        text?: string;
        name?: string;
        args?: unknown;
      }>;
      expect(content.length).toBe(2);
      expect(content[0]!.type).toBe("text");
      expect(content[0]!.text).toBe("Let me search.");
      expect(content[1]!.type).toBe("tool_call");
      expect(content[1]!.name).toBe("web_search");
      expect(content[1]!.args).toEqual({ query: "weather" });
    });

    test("await stream returns AIMessage directly", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      const message = await new ChatModelStream(
        model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
      );
      expect(message._getType()).toBe("ai");
      expect(message.id).toBe("chatcmpl-abc");
    });
  });

  describe("streaming events", () => {
    test("streams text", async () => {
      const model = new MockStreamChatOpenAICompletions(textOnlyChunks());
      await expect(model.streamV2("Hello")).toHaveStreamText("Hello world");
    });

    test("streams tool calls", async () => {
      const model = new MockStreamChatOpenAICompletions(toolCallChunks());
      await expect(model.streamV2("Hello")).toHaveStreamToolCalls([
        { name: "web_search", args: { query: "weather" } },
      ]);
    });

    test("streams reasoning", async () => {
      const model = new MockStreamChatOpenAICompletions(
        reasoningPlusTextChunks()
      );
      await expect(model.streamV2("Hello")).toHaveStreamReasoning(
        "Let me reason..."
      );
    });
  });
});
