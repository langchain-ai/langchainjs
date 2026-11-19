import { describe, test, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { Stream } from "@anthropic-ai/sdk/streaming";
import { ChatAnthropic } from "../chat_models.js";
import type { AnthropicMessageStreamEvent } from "../types.js";

function makeResponse(stopReason: string | null) {
  return {
    id: "msg_01",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [{ type: "text", text: "Hi" }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 5, output_tokens: 2 },
  };
}

function makeModel(stopReason: string | null) {
  const model = new ChatAnthropic({
    apiKey: "fake-key",
    model: "claude-sonnet-4-20250514",
  });
  vi.spyOn(
    model as unknown as { completionWithRetry: () => Promise<unknown> },
    "completionWithRetry"
  ).mockResolvedValue(makeResponse(stopReason));
  return model;
}

function streamEvents(stopReason: string) {
  return [
    {
      type: "message_start",
      message: {
        id: "msg_01",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-sonnet-4-20250514",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hi" },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 2 },
    },
    { type: "message_stop" },
  ];
}

function makeStreamingModel(stopReason: string) {
  const model = new ChatAnthropic({
    apiKey: "fake-key",
    model: "claude-sonnet-4-20250514",
  });
  const events = streamEvents(stopReason);
  vi.spyOn(
    model as unknown as { createStreamWithRetry: () => Promise<unknown> },
    "createStreamWithRetry"
  ).mockResolvedValue({
    controller: { abort: () => {} },
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event as AnthropicMessageStreamEvent;
      }
    },
  } as unknown as Stream<AnthropicMessageStreamEvent>);
  return model;
}

describe("finish reason response_metadata", () => {
  test.each([
    ["end_turn", "stop", "complete"],
    ["stop_sequence", "stop", "complete"],
    ["max_tokens", "length", "complete"],
    ["tool_use", "tool_call", "complete"],
    ["refusal", "refusal", "complete"],
    ["model_context_window_exceeded", "context_exceeded", "complete"],
    ["pause_turn", "other", "suspended"],
    ["some_future_reason", "other", "complete"],
  ])("invoke maps %s", async (stopReason, normalized, state) => {
    const model = makeModel(stopReason);
    const result = await model._generate([new HumanMessage("Hi")], {});
    const metadata = result.generations[0].message.response_metadata;
    expect(metadata).toMatchObject({
      stop_reason: stopReason,
      finish_reason: stopReason,
      normalized_finish_reason: normalized,
      finish_state: state,
    });
  });

  test("invoke sets nothing when stop_reason is missing", async () => {
    const model = makeModel(null);
    const result = await model._generate([new HumanMessage("Hi")], {});
    const metadata = result.generations[0].message.response_metadata;
    expect(metadata).not.toHaveProperty("finish_reason");
    expect(metadata).not.toHaveProperty("normalized_finish_reason");
    expect(metadata).not.toHaveProperty("finish_state");
  });

  test("legacy stream sets the keys only on the message_delta chunk", async () => {
    const model = makeStreamingModel("pause_turn");
    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hi")],
      {}
    )) {
      chunks.push(chunk);
    }
    const withFinish = chunks.filter(
      (chunk) => "finish_reason" in chunk.message.response_metadata
    );
    expect(withFinish).toHaveLength(1);
    expect(withFinish[0].message.additional_kwargs.stop_reason).toBe(
      "pause_turn"
    );
    expect(withFinish[0].message.response_metadata).toMatchObject({
      finish_reason: "pause_turn",
      normalized_finish_reason: "other",
      finish_state: "suspended",
    });
  });

  test("legacy stream aggregates to the raw finish reason", async () => {
    const model = makeStreamingModel("max_tokens");
    let full;
    for await (const chunk of await model.stream("Hi")) {
      full = full ? full.concat(chunk) : chunk;
    }
    expect(full?.response_metadata).toMatchObject({
      finish_reason: "max_tokens",
      normalized_finish_reason: "length",
      finish_state: "complete",
    });
  });
});
