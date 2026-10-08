import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { AIMessage } from "@langchain/core/messages";
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

function itemDone(
  outputIndex: number,
  item: Record<string, unknown>
): RawEvent {
  return {
    type: "response.output_item.done",
    output_index: outputIndex,
    sequence_number: 0,
    item,
  } as unknown as RawEvent;
}

function translatorBlocks(item: Record<string, unknown>) {
  return new AIMessage({
    content: [],
    additional_kwargs: { tool_outputs: [item] },
    response_metadata: { model_provider: "openai" },
  }).contentBlocks;
}

const finishes = (events: ChatModelStreamEvent[]) =>
  events.filter((e) => e.event === "content-block-finish");

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

  describe("server tool and other output items", () => {
    const webSearchCall = {
      type: "web_search_call",
      id: "ws_1",
      status: "completed",
      action: {
        type: "search",
        query: "weather berlin",
        sources: [{ type: "url", url: "https://example.com" }],
      },
    };

    test.each([
      ["web_search_call", webSearchCall],
      [
        "file_search_call",
        {
          type: "file_search_call",
          id: "fs_1",
          status: "completed",
          queries: ["contract terms"],
          results: [{ file_id: "file_1", filename: "a.pdf", text: "terms" }],
        },
      ],
      [
        "tool_search_call",
        {
          type: "tool_search_call",
          id: "ts_1",
          call_id: "call_ts_1",
          status: "completed",
          execution: "server",
          arguments: { query: "weather" },
        },
      ],
      [
        "tool_search_output",
        {
          type: "tool_search_output",
          id: "tso_1",
          status: "completed",
          execution: "server",
          tools: [],
        },
      ],
    ])("%s yields the translator's blocks", async (_type, item) => {
      const events = await collectEvents([
        itemDone(0, item),
        completedResponse(),
      ]);

      const expected = translatorBlocks(item);
      expect(expected.length).toBeGreaterThan(0);
      expect(
        events
          .filter((e) => e.event === "content-block-start")
          .map((e) => e.content)
      ).toEqual(expected);
      expect(finishes(events).map((e) => e.content)).toEqual(expected);
    });

    test("code_interpreter_call becomes non_standard without created_by", async () => {
      const item = {
        type: "code_interpreter_call",
        id: "ci_1",
        status: "completed",
        code: "print(1)",
        container_id: "cntr_1",
        outputs: [{ type: "logs", logs: "1" }],
        created_by: "user_1",
      };
      const events = await collectEvents([
        itemDone(0, item),
        completedResponse(),
      ]);

      const { created_by: _createdBy, ...value } = item;
      expect(finishes(events)).toEqual([
        {
          event: "content-block-finish",
          index: 0,
          content: { type: "non_standard", value },
        },
      ]);
    });

    test("unknown item type becomes non_standard", async () => {
      const item = { type: "future_call", id: "fut_1", created_by: "user_1" };
      const events = await collectEvents([
        itemDone(0, item),
        completedResponse(),
      ]);

      expect(finishes(events).map((e) => e.content)).toEqual([
        { type: "non_standard", value: { type: "future_call", id: "fut_1" } },
      ]);
    });

    test("keeps block indexes in output order", async () => {
      const events = await collectEvents([
        reasoningDone(0, { id: "rs_1", encrypted_content: "enc_1" }),
        itemDone(1, webSearchCall),
        {
          type: "response.output_text.delta",
          delta: "Sunny",
          content_index: 0,
          output_index: 2,
        } as RawEvent,
        itemDone(2, {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Sunny", annotations: [] }],
        }),
        itemDone(3, {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "lookup",
          arguments: "{}",
        }),
        completedResponse(),
      ]);

      expect(
        events
          .filter((e) => e.event === "content-block-start")
          .map((e) => [e.index, e.content.type])
      ).toEqual([
        [0, "reasoning"],
        [1, "server_tool_call"],
        [2, "server_tool_call_result"],
        [3, "text"],
        [4, "tool_call_chunk"],
      ]);
    });
  });

  describe("text annotations", () => {
    const textDelta = (delta: string): RawEvent =>
      ({
        type: "response.output_text.delta",
        delta,
        content_index: 0,
        output_index: 0,
      }) as RawEvent;
    const annotationAdded = (
      annotationIndex: number,
      annotation: Record<string, unknown>
    ): RawEvent =>
      ({
        type: "response.output_text.annotation.added",
        output_index: 0,
        content_index: 0,
        annotation_index: annotationIndex,
        item_id: "msg_1",
        sequence_number: 0,
        annotation,
      }) as unknown as RawEvent;

    test("finished text block carries url and file citations", async () => {
      const events = await collectEvents([
        textDelta("Sunny, see report."),
        annotationAdded(0, {
          type: "url_citation",
          url: "https://example.com",
          title: "Weather",
          start_index: 0,
          end_index: 5,
        }),
        annotationAdded(1, {
          type: "file_citation",
          file_id: "file_1",
          filename: "report.pdf",
          index: 17,
        }),
        completedResponse(),
      ]);

      expect(finishes(events)).toEqual([
        {
          event: "content-block-finish",
          index: 0,
          content: {
            type: "text",
            text: "Sunny, see report.",
            annotations: [
              {
                type: "citation",
                source: "url_citation",
                url: "https://example.com",
                title: "Weather",
                startIndex: 0,
                endIndex: 5,
              },
              {
                type: "citation",
                source: "file_citation",
                title: "report.pdf",
                startIndex: 17,
                file_id: "file_1",
              },
            ],
          },
        },
      ]);
    });

    test("text without annotations has no annotations key", async () => {
      const events = await collectEvents([
        textDelta("Hello"),
        completedResponse(),
      ]);

      expect(finishes(events).map((e) => e.content)).toEqual([
        { type: "text", text: "Hello" },
      ]);
    });
  });
});
