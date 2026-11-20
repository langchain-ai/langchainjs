import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { OpenAI as OpenAIClient } from "openai";
import { convertOpenAIResponsesStream } from "../responses_stream_events.js";

type RawEvent = OpenAIClient.Responses.ResponseStreamEvent;

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collectEvents(
  events: RawEvent[]
): Promise<ChatModelStreamEvent[]> {
  const out: ChatModelStreamEvent[] = [];
  for await (const event of convertOpenAIResponsesStream(
    asAsyncIterable(events)
  )) {
    out.push(event);
  }
  return out;
}

function completedResponse(overrides: Record<string, unknown> = {}): RawEvent {
  return {
    type: "response.completed",
    response: {
      id: "resp_done",
      object: "response",
      created_at: 0,
      status: "completed",
      model: "gpt-4o-mini",
      output: [],
      parallel_tool_calls: true,
      tool_choice: "auto",
      tools: [],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
      ...overrides,
    },
  } as RawEvent;
}

describe("convertOpenAIResponsesStream", () => {
  test("text-only lifecycle", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_abc", model: "gpt-4o-mini" },
      } as RawEvent,
      {
        type: "response.output_text.delta",
        delta: "Hello",
        content_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.output_text.delta",
        delta: " world",
        content_index: 0,
        output_index: 0,
      } as RawEvent,
      completedResponse({ id: "resp_abc" }),
    ]);

    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");

    const deltas = events.filter(
      (e) =>
        e.event === "content-block-delta" &&
        (e as { delta: { type: string } }).delta.type === "text-delta"
    );
    expect(deltas).toHaveLength(2);
    expect((deltas[0] as { delta: { text: string } }).delta.text).toBe("Hello");
    expect((deltas[1] as { delta: { text: string } }).delta.text).toBe(
      " world"
    );

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: { text: "Hello world" },
    });
  });

  test("keeps text blocks separate across output items", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_multi_text", model: "gpt-4o-mini" },
      } as RawEvent,
      {
        type: "response.output_text.delta",
        delta: "First",
        content_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.output_text.delta",
        delta: "Second",
        content_index: 0,
        output_index: 1,
      } as RawEvent,
      completedResponse({ id: "resp_multi_text" }),
    ]);

    const textFinishes = events.filter(
      (e) => e.event === "content-block-finish" && e.content.type === "text"
    );
    expect(textFinishes).toMatchObject([
      { index: 0, content: { type: "text", text: "First" } },
      { index: 1, content: { type: "text", text: "Second" } },
    ]);
  });

  test("reasoning deltas", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_r", model: "o3" },
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        delta: "Let me",
        summary_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        delta: " think",
        summary_index: 0,
        output_index: 0,
      } as RawEvent,
      completedResponse({ id: "resp_r" }),
    ]);

    const reasoningDeltas = events.filter(
      (e) =>
        e.event === "content-block-delta" &&
        (e as { delta: { type: string } }).delta.type === "reasoning-delta"
    );
    expect(reasoningDeltas).toHaveLength(2);
  });

  test("keeps reasoning blocks separate across output items", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_multi_reasoning", model: "o3" },
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        delta: "First thought",
        summary_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        delta: "Second thought",
        summary_index: 0,
        output_index: 1,
      } as RawEvent,
      completedResponse({ id: "resp_multi_reasoning" }),
    ]);

    const reasoningFinishes = events.filter(
      (e) =>
        e.event === "content-block-finish" && e.content.type === "reasoning"
    );
    expect(reasoningFinishes).toMatchObject([
      {
        index: 0,
        content: { type: "reasoning", reasoning: "First thought" },
      },
      {
        index: 1,
        content: { type: "reasoning", reasoning: "Second thought" },
      },
    ]);
  });

  test("keeps a reasoning item's id, summary parts and encrypted content on one block", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_r", model: "o3" },
      } as RawEvent,
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { type: "reasoning", id: "rs_1", summary: [] },
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        item_id: "rs_1",
        delta: "First",
        summary_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.reasoning_summary_text.delta",
        item_id: "rs_1",
        delta: "Second",
        summary_index: 1,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.output_item.done",
        output_index: 0,
        item: {
          type: "reasoning",
          id: "rs_1",
          summary: [],
          encrypted_content: "ENC",
        },
      } as RawEvent,
      completedResponse({ id: "resp_r" }),
    ]);

    const blockEvents = events.filter((e) => e.event.startsWith("content-"));
    expect(blockEvents).toEqual([
      {
        event: "content-block-start",
        index: 0,
        content: { type: "reasoning", reasoning: "", id: "rs_1" },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "reasoning-delta", reasoning: "First" },
      },
      {
        event: "content-block-delta",
        index: 0,
        delta: { type: "reasoning-delta", reasoning: "\n\nSecond" },
      },
      {
        event: "content-block-finish",
        index: 0,
        content: {
          type: "reasoning",
          reasoning: "First\n\nSecond",
          id: "rs_1",
          encrypted_content: "ENC",
        },
      },
    ]);
  });

  test("emits a reasoning block for an item with no summary", async () => {
    const events = await collectEvents([
      {
        type: "response.output_item.done",
        output_index: 0,
        item: {
          type: "reasoning",
          id: "rs_2",
          summary: [],
          encrypted_content: "ENC",
        },
      } as RawEvent,
      completedResponse(),
    ]);

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: {
        type: "reasoning",
        reasoning: "",
        id: "rs_2",
        encrypted_content: "ENC",
      },
    });
  });

  test("puts the item id on text starts and annotations on the finished block", async () => {
    const citation = {
      type: "url_citation",
      url: "https://example.com/a",
      title: "A",
      start_index: 0,
      end_index: 5,
    };
    const events = await collectEvents([
      {
        type: "response.output_text.delta",
        item_id: "msg_1",
        delta: "Found.",
        content_index: 0,
        output_index: 0,
      } as RawEvent,
      {
        type: "response.output_text.annotation.added",
        item_id: "msg_1",
        output_index: 0,
        content_index: 0,
        annotation_index: 0,
        annotation: citation,
      } as RawEvent,
      completedResponse(),
    ]);

    expect(events.find((e) => e.event === "content-block-start")).toMatchObject(
      { content: { type: "text", text: "", id: "msg_1" } }
    );
    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({
      content: {
        type: "text",
        text: "Found.",
        id: "msg_1",
        annotations: [
          {
            type: "citation",
            source: "url_citation",
            url: "https://example.com/a",
          },
        ],
      },
    });
  });

  test("keeps built-in tool items whole as non_standard blocks", async () => {
    const search = {
      type: "web_search_call",
      id: "ws_1",
      status: "completed",
      action: { type: "search", query: "q" },
    };
    const events = await collectEvents([
      {
        type: "response.output_item.done",
        output_index: 0,
        item: search,
      } as RawEvent,
      completedResponse(),
    ]);

    expect(
      events.find((e) => e.event === "content-block-finish")
    ).toMatchObject({ content: { type: "non_standard", value: search } });
    expect(
      events.find(
        (e) => e.event === "provider" && e.name === "response.output_item.done"
      )
    ).toBeDefined();
  });

  test("tool call streaming and finalization", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_tools", model: "gpt-4o-mini" },
      } as RawEvent,
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_1",
          call_id: "call_abc",
          name: "web_search",
          arguments: "",
        },
      } as RawEvent,
      {
        type: "response.function_call_arguments.delta",
        output_index: 0,
        delta: '{"query"',
      } as RawEvent,
      {
        type: "response.function_call_arguments.delta",
        output_index: 0,
        delta: ':"weather"}',
      } as RawEvent,
      {
        type: "response.output_item.done",
        output_index: 0,
        item: {
          type: "function_call",
          id: "fc_1",
          call_id: "call_abc",
          name: "web_search",
          arguments: '{"query":"weather"}',
        },
      } as RawEvent,
      completedResponse({ id: "resp_tools" }),
    ]);

    expect(
      events.find(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "tool_call"
      )
    ).toMatchObject({
      content: {
        name: "web_search",
        args: { query: "weather" },
      },
    });
  });

  test("usage snapshot on completed", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_u", model: "gpt-4o-mini" },
      } as RawEvent,
      completedResponse({
        id: "resp_u",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          total_tokens: 120,
          input_tokens_details: { cached_tokens: 40 },
          output_tokens_details: { reasoning_tokens: 5 },
        },
      }),
    ]);

    const usage = events.find((e) => e.event === "usage") as {
      usage: { input_tokens: number; output_tokens: number };
    };
    expect(usage.usage.input_tokens).toBe(100);
    expect(usage.usage.output_tokens).toBe(20);
  });

  test("message-finish carries the served model as model_name", async () => {
    const events = await collectEvents([
      {
        type: "response.created",
        response: { id: "resp_m", model: "gpt-5.4-2026-03-05" },
      } as RawEvent,
      completedResponse({ id: "resp_m", model: "gpt-5.4-2026-03-05" }),
    ]);

    expect(events.find((e) => e.event === "message-finish")).toMatchObject({
      responseMetadata: {
        model: "gpt-5.4-2026-03-05",
        model_name: "gpt-5.4-2026-03-05",
      },
    });
  });

  test("streamUsage false suppresses usage", async () => {
    const out: ChatModelStreamEvent[] = [];
    for await (const event of convertOpenAIResponsesStream(
      asAsyncIterable([
        {
          type: "response.created",
          response: { id: "resp_x", model: "gpt-4o-mini" },
        } as RawEvent,
        completedResponse({ id: "resp_x" }),
      ]),
      { streamUsage: false }
    )) {
      out.push(event);
    }
    expect(out.filter((e) => e.event === "usage")).toHaveLength(0);
  });
});
