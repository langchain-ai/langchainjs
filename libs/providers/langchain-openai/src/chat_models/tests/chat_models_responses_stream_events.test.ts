import { describe, test, expect } from "vitest";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import type { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { OpenAI as OpenAIClient } from "openai";
import { ChatOpenAIResponses } from "../responses.js";

type RawEvent = OpenAIClient.Responses.ResponseStreamEvent;

class MockStreamChatOpenAIResponses extends ChatOpenAIResponses {
  private mockEvents: RawEvent[];

  constructor(mockEvents: RawEvent[]) {
    super({ apiKey: "fake-key", model: "gpt-4o-mini", streaming: true });
    this.mockEvents = mockEvents;
  }

  override async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsStreaming
  ): Promise<AsyncIterable<RawEvent>> {
    const events = this.mockEvents;
    return {
      async *[Symbol.asyncIterator]() {
        for (const event of events) {
          yield event;
        }
      },
    };
  }
}

function textEvents(): RawEvent[] {
  return [
    {
      type: "response.created",
      response: { id: "resp_test", model: "gpt-4o-mini" },
    } as RawEvent,
    {
      type: "response.output_text.delta",
      delta: "Hi",
      content_index: 0,
      output_index: 0,
    } as RawEvent,
    {
      type: "response.completed",
      response: {
        id: "resp_test",
        object: "response",
        created_at: 0,
        status: "completed",
        model: "gpt-4o-mini",
        output: [],
        parallel_tool_calls: true,
        tool_choice: "auto",
        tools: [],
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
      },
    } as RawEvent,
  ];
}

function reasoningEvents(): RawEvent[] {
  return [
    {
      type: "response.created",
      response: { id: "resp_reasoning", model: "o3" },
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
    {
      type: "response.completed",
      response: {
        id: "resp_reasoning",
        object: "response",
        created_at: 0,
        status: "completed",
        model: "o3",
        output: [],
        parallel_tool_calls: true,
        tool_choice: "auto",
        tools: [],
      },
    } as RawEvent,
  ];
}

function toolEvents(): RawEvent[] {
  return [
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
    {
      type: "response.completed",
      response: {
        id: "resp_tools",
        object: "response",
        created_at: 0,
        status: "completed",
        model: "gpt-4o-mini",
        output: [],
        parallel_tool_calls: true,
        tool_choice: "auto",
        tools: [],
      },
    } as RawEvent,
  ];
}

describe("ChatOpenAIResponses._streamChatModelEvents", () => {
  test("integration with ChatModelStream.text", async () => {
    const model = new MockStreamChatOpenAIResponses(textEvents());
    const stream = new ChatModelStream(
      model._streamChatModelEvents([], {} as BaseChatModelCallOptions)
    );
    expect(await stream.text).toBe("Hi");
  });

  test("emits message-start with id", async () => {
    const model = new MockStreamChatOpenAIResponses(textEvents());
    const events: ChatModelStreamEvent[] = [];
    for await (const event of model._streamChatModelEvents(
      [],
      {} as BaseChatModelCallOptions
    )) {
      events.push(event);
    }
    const start = events.find((e) => e.event === "message-start") as {
      id?: string;
    };
    expect(start.id).toBe("resp_test");
  });

  describe("streaming events", () => {
    test("streams text", async () => {
      const model = new MockStreamChatOpenAIResponses(textEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamText("Hi");
    });

    test("streams usage", async () => {
      const model = new MockStreamChatOpenAIResponses(textEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamUsage({
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: 2,
      });
    });

    test("streams reasoning", async () => {
      const model = new MockStreamChatOpenAIResponses(reasoningEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamReasoning(
        "Let me think"
      );
    });

    test("streams tool calls", async () => {
      const model = new MockStreamChatOpenAIResponses(toolEvents());
      await expect(model.streamEvents("Hello")).toHaveStreamToolCalls([
        { name: "web_search", args: { query: "weather" } },
      ]);
    });
  });
});
