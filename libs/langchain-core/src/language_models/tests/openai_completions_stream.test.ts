import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "../event.js";
import {
  convertOpenAICompletionsStream,
  type OpenAICompletionsStreamChunk,
} from "../openai_completions_stream.js";
import { ChatModelStream } from "../stream.js";

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collectEvents(
  chunks: OpenAICompletionsStreamChunk[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  for await (const event of convertOpenAICompletionsStream(
    asAsyncIterable(chunks)
  )) {
    out.push(event);
  }
  return out;
}

describe("convertOpenAICompletionsStream", () => {
  test("text-only lifecycle", async () => {
    const events = await collectEvents([
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello" },
            finish_reason: null,
          },
        ],
      },
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: { content: " world" },
            finish_reason: null,
          },
        ],
      },
      {
        id: "chatcmpl-abc",
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      },
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    const finish = events.find((e) => e.event === "content-block-finish");
    if (
      finish?.event !== "content-block-finish" ||
      finish.content.type !== "text"
    ) {
      throw new Error("Expected finalized text content block");
    }
    expect(finish.content.text).toBe("Hello world");
  });

  test("reasoning_content deltas", async () => {
    const events = await collectEvents([
      {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", reasoning_content: "think" },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
    ]);

    const reasoningFinish = events.find(
      (e) =>
        e.event === "content-block-finish" && e.content.type === "reasoning"
    );
    if (
      reasoningFinish?.event !== "content-block-finish" ||
      reasoningFinish.content.type !== "reasoning"
    ) {
      throw new Error("Expected finalized reasoning content block");
    }
    expect(reasoningFinish.content.reasoning).toBe("think");
  });

  test("streams tool call args as slices", async () => {
    const stream = new ChatModelStream(
      convertOpenAICompletionsStream(
        asAsyncIterable<OpenAICompletionsStreamChunk>([
          {
            id: "chatcmpl-tools",
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_abc",
                      type: "function",
                      function: { name: "web_search", arguments: "" },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: '{"query"' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: ':"weather"}' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          },
        ])
      )
    );
    const events: ChatModelStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.filter((e) => e.event.startsWith("content-block"))).toEqual([
      {
        event: "content-block-start",
        index: 0,
        content: {
          type: "tool_call_chunk",
          id: "call_abc",
          name: "web_search",
          args: "",
          index: 0,
        },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: '{"query"' },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: ':"weather"}' },
      },
      {
        event: "content-block-finish",
        index: 0,
        content: {
          type: "tool_call",
          id: "call_abc",
          name: "web_search",
          args: { query: "weather" },
        },
      },
    ]);
    expect((await stream).tool_calls).toEqual([
      {
        type: "tool_call",
        id: "call_abc",
        name: "web_search",
        args: { query: "weather" },
      },
    ]);
  });

  test("sends a late tool call id and name on the finish, not a delta", async () => {
    const stream = new ChatModelStream(
      convertOpenAICompletionsStream(
        asAsyncIterable<OpenAICompletionsStreamChunk>([
          {
            id: "chatcmpl-tools",
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  tool_calls: [
                    { index: 0, function: { arguments: '{"query"' } },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_abc",
                      function: {
                        name: "web_search",
                        arguments: ':"weather"}',
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          },
        ])
      )
    );
    const events: ChatModelStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.filter((e) => e.event === "content-block-delta")).toEqual([
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: '{"query"' },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "tool-call-delta", args: ':"weather"}' },
      },
    ]);
    expect((await stream).tool_calls).toEqual([
      {
        type: "tool_call",
        id: "call_abc",
        name: "web_search",
        args: { query: "weather" },
      },
    ]);
  });
});
