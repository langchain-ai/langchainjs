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
      await expect(model.streamV2("Hello")).toHaveStreamText("Hi");
    });
  });
});
