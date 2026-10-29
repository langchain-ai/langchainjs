import { describe, test, expect, beforeEach } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import type { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  ChatXAIResponses,
  type XAIResponsesCreateParams,
  type XAIResponsesCreateParamsStreaming,
} from "../responses.js";
import type {
  XAIResponsesStreamEvent,
  XAIResponse,
} from "../responses-types.js";

beforeEach(() => {
  process.env.XAI_API_KEY = "fake-key";
});

class MockStreamChatXAIResponses extends ChatXAIResponses {
  private mockEvents: XAIResponsesStreamEvent[];

  constructor(mockEvents: XAIResponsesStreamEvent[]) {
    super({ apiKey: "fake-key", model: "grok-3", streaming: true });
    this.mockEvents = mockEvents;
  }

  protected override async _makeRequest(
    request: XAIResponsesCreateParamsStreaming
  ): Promise<AsyncIterable<XAIResponsesStreamEvent>>;

  protected override async _makeRequest(
    request: XAIResponsesCreateParams
  ): Promise<XAIResponse | AsyncIterable<XAIResponsesStreamEvent>>;

  protected override async _makeRequest(
    request: XAIResponsesCreateParams
  ): Promise<XAIResponse | AsyncIterable<XAIResponsesStreamEvent>> {
    if (request.stream) {
      const events = this.mockEvents;
      return {
        async *[Symbol.asyncIterator]() {
          for (const event of events) {
            yield event;
          }
        },
      };
    }
    throw new Error("non-streaming not mocked");
  }
}

function textEvents(): XAIResponsesStreamEvent[] {
  return [
    {
      type: "response.created",
      response: { id: "resp_xai", model: "grok-3" },
    } as XAIResponsesStreamEvent,
    {
      type: "response.output_text.delta",
      delta: "Hello",
      content_index: 0,
      output_index: 0,
    } as XAIResponsesStreamEvent,
    {
      type: "response.completed",
      response: {
        id: "resp_xai",
        object: "response",
        created_at: 0,
        status: "completed",
        model: "grok-3",
        output: [],
        usage: {
          input_tokens: 3,
          output_tokens: 2,
          total_tokens: 5,
        },
      },
    } as XAIResponsesStreamEvent,
  ];
}

function reasoningEvents(): XAIResponsesStreamEvent[] {
  return [
    {
      type: "response.created",
      response: { id: "resp_reasoning", model: "grok-3" },
    } as XAIResponsesStreamEvent,
    {
      type: "response.reasoning_summary_text.delta",
      delta: "thinking",
      summary_index: 0,
      output_index: 0,
    } as XAIResponsesStreamEvent,
    {
      type: "response.completed",
      response: {
        id: "resp_reasoning",
        status: "completed",
        model: "grok-3",
        output: [],
      },
    } as XAIResponsesStreamEvent,
  ];
}

function toolEvents(): XAIResponsesStreamEvent[] {
  return [
    {
      type: "response.created",
      response: { id: "resp_tools", model: "grok-3" },
    } as XAIResponsesStreamEvent,
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
    } as XAIResponsesStreamEvent,
    {
      type: "response.function_call_arguments.delta",
      output_index: 0,
      delta: '{"query"',
    } as XAIResponsesStreamEvent,
    {
      type: "response.function_call_arguments.delta",
      output_index: 0,
      delta: ':"weather"}',
    } as XAIResponsesStreamEvent,
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
    } as XAIResponsesStreamEvent,
  ];
}

describe("ChatXAIResponses._streamChatModelEvents", () => {
  test("ChatModelStream.text end-to-end", async () => {
    const model = new MockStreamChatXAIResponses(textEvents());
    const stream = new ChatModelStream(
      model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
    );
    expect(await stream.text).toBe("Hello");
  });

  test("emits lifecycle events", async () => {
    const model = new MockStreamChatXAIResponses(textEvents());
    const events: ChatModelStreamEvent[] = [];
    for await (const event of model._streamChatModelEvents(
      [],
      {} as BaseChatModelCallOptions
    )) {
      events.push(event);
    }
    expect(events.map((e) => e.event)).toContain("message-start");
    expect(events.map((e) => e.event)).toContain("message-finish");
  });

  describe("streaming events", () => {
    test("streams text", async () => {
      const model = new MockStreamChatXAIResponses(textEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamText("Hello");
    });

    test("streams usage", async () => {
      const model = new MockStreamChatXAIResponses(textEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamUsage({
        input_tokens: 3,
        output_tokens: 2,
        total_tokens: 5,
      });
    });

    test("streams reasoning", async () => {
      const model = new MockStreamChatXAIResponses(reasoningEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamReasoning(
        "thinking"
      );
    });

    test("streams tool call args as slices", async () => {
      const model = new MockStreamChatXAIResponses(toolEvents());
      const stream = model.streamEvents("Hello");
      const events: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events.filter((e) => e.event.startsWith("content-block"))).toEqual(
        [
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
        ]
      );
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
});
