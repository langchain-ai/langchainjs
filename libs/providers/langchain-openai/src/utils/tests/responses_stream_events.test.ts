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

function reasoningDone(
  outputIndex: number,
  item: { id: string } & Record<string, unknown>
): RawEvent {
  return {
    type: "response.output_item.done",
    output_index: outputIndex,
    sequence_number: 0,
    item: { type: "reasoning", summary: [], ...item },
  } as RawEvent;
}

function summaryDelta(
  outputIndex: number,
  summaryIndex: number,
  delta: string
): RawEvent {
  return {
    type: "response.reasoning_summary_text.delta",
    delta,
    summary_index: summaryIndex,
    output_index: outputIndex,
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

  describe("reasoning items", () => {
    const reasoningFinishes = (events: ChatModelStreamEvent[]) =>
      events.filter(
        (e) =>
          e.event === "content-block-finish" && e.content.type === "reasoning"
      );

    test("emits a block at done when summaries are off", async () => {
      const events = await collectEvents([
        reasoningDone(0, { id: "rs_1", encrypted_content: "enc_1" }),
        completedResponse(),
      ]);

      expect(
        events.filter(
          (e) =>
            e.event === "content-block-start" && e.content.type === "reasoning"
        )
      ).toMatchObject([{ index: 0, content: { reasoning: "" } }]);
      expect(reasoningFinishes(events)).toMatchObject([
        {
          index: 0,
          content: {
            type: "reasoning",
            reasoning: "",
            id: "rs_1",
            encrypted_content: "enc_1",
            summary: [],
          },
        },
      ]);
    });

    test("finishes a one-part summary with id and encrypted content", async () => {
      const summary = [{ type: "summary_text", text: "Let me think" }];
      const events = await collectEvents([
        summaryDelta(0, 0, "Let me"),
        summaryDelta(0, 0, " think"),
        reasoningDone(0, { id: "rs_1", encrypted_content: "enc_1", summary }),
        completedResponse(),
      ]);

      expect(reasoningFinishes(events)).toMatchObject([
        {
          index: 0,
          content: {
            reasoning: "Let me think",
            id: "rs_1",
            encrypted_content: "enc_1",
            summary,
          },
        },
      ]);
    });

    test("streams all summary parts into one block per item", async () => {
      const summary = [
        { type: "summary_text", text: "Part one." },
        { type: "summary_text", text: "Part two." },
      ];
      const events = await collectEvents([
        summaryDelta(0, 0, "Part one."),
        summaryDelta(0, 1, "Part two."),
        reasoningDone(0, { id: "rs_1", encrypted_content: "enc_1", summary }),
        completedResponse(),
      ]);

      expect(
        events.filter(
          (e) =>
            e.event === "content-block-start" && e.content.type === "reasoning"
        )
      ).toHaveLength(1);
      expect(reasoningFinishes(events)).toMatchObject([
        {
          index: 0,
          content: {
            reasoning: "Part one.Part two.",
            id: "rs_1",
            encrypted_content: "enc_1",
            summary,
          },
        },
      ]);
    });

    test("omits encrypted_content when the item has none", async () => {
      const events = await collectEvents([
        summaryDelta(0, 0, "Thinking"),
        reasoningDone(0, { id: "rs_1", encrypted_content: null }),
        completedResponse(),
      ]);

      const [finish] = reasoningFinishes(events);
      expect(finish).toMatchObject({ content: { id: "rs_1" } });
      expect(finish).not.toHaveProperty("content.encrypted_content");
    });

    test("keeps two reasoning items and a following text block in order", async () => {
      const events = await collectEvents([
        summaryDelta(0, 0, "First"),
        reasoningDone(0, { id: "rs_1", encrypted_content: "enc_1" }),
        reasoningDone(1, { id: "rs_2", encrypted_content: "enc_2" }),
        {
          type: "response.output_text.delta",
          delta: "Answer",
          content_index: 0,
          output_index: 2,
        } as RawEvent,
        completedResponse(),
      ]);

      expect(
        events.filter((e) => e.event === "content-block-finish")
      ).toMatchObject([
        { index: 0, content: { reasoning: "First", id: "rs_1" } },
        { index: 1, content: { reasoning: "", id: "rs_2" } },
        { index: 2, content: { type: "text", text: "Answer" } },
      ]);
    });
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
