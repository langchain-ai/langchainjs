import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import { convertChunksToEvents } from "../compat.js";
import type { ChatModelStreamEvent, MessageFinishEvent } from "../event.js";
import {
  normalizeFinishReason,
  toLegacyFinishReason,
} from "../finish_reason.js";
import { ChatModelStream } from "../stream.js";

async function* iter<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function lastEvent(
  chunks: ChatGenerationChunk[]
): Promise<MessageFinishEvent> {
  const events: ChatModelStreamEvent[] = [];
  for await (const event of convertChunksToEvents(iter(chunks))) {
    events.push(event);
  }
  return events[events.length - 1] as MessageFinishEvent;
}

describe("normalizeFinishReason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["max_tokens", "length"],
    ["tool_calls", "tool_call"],
    ["function_call", "tool_call"],
    ["content_filter", "content_filter"],
    ["end_turn", "stop"],
    ["stop_sequence", "stop"],
    ["tool_use", "tool_call"],
    ["refusal", "refusal"],
    ["model_context_window_exceeded", "context_exceeded"],
    ["STOP", "stop"],
    ["MAX_TOKENS", "length"],
    ["SAFETY", "refusal"],
    ["RECITATION", "content_filter"],
    ["IMAGE-SAFETY", "content_filter"],
    ["MALFORMED_FUNCTION_CALL", "other"],
    ["something_new", "other"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeFinishReason(raw)).toEqual({
      normalizedFinishReason: expected,
      finishState: "complete",
    });
  });

  test("pause_turn is suspended", () => {
    expect(normalizeFinishReason("pause_turn")).toEqual({
      normalizedFinishReason: "other",
      finishState: "suspended",
    });
  });

  test("stop with tool calls is tool_call", () => {
    expect(
      normalizeFinishReason("STOP", { hasToolCalls: true })
        .normalizedFinishReason
    ).toBe("tool_call");
  });

  test("missing raw value is omitted", () => {
    expect(normalizeFinishReason(undefined)).toEqual({});
    expect(normalizeFinishReason("")).toEqual({});
  });
});

describe("convertChunksToEvents finish fields", () => {
  test("reads raw reason from generationInfo", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "hi",
        message: new AIMessageChunk({ content: "hi" }),
      }),
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({ content: "" }),
        generationInfo: { finish_reason: "length" },
      }),
    ]);
    expect(finish).toMatchObject({
      event: "message-finish",
      finishReason: "length",
      normalizedFinishReason: "length",
      finishState: "complete",
    });
  });

  test("reads Anthropic stop_reason from response_metadata", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          response_metadata: { stop_reason: "pause_turn" },
        }),
      }),
    ]);
    expect(finish).toMatchObject({
      finishReason: "pause_turn",
      normalizedFinishReason: "other",
      finishState: "suspended",
    });
  });

  test("stop with tool call chunks is tool_call", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            { id: "call_1", name: "search", args: "{}", index: 0 },
          ],
          response_metadata: { finishReason: "STOP" },
        }),
      }),
    ]);
    expect(finish.normalizedFinishReason).toBe("tool_call");
  });

  test("no raw reason omits finish fields", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "hi",
        message: new AIMessageChunk({ content: "hi" }),
      }),
    ]);
    expect(finish).not.toHaveProperty("finishReason");
    expect(finish).not.toHaveProperty("normalizedFinishReason");
  });
});

describe("ChatModelStream finish assembly", () => {
  test("writes raw, normalized, and state to response_metadata", async () => {
    const stream = new ChatModelStream(
      iter<ChatModelStreamEvent>([
        { event: "message-start", id: "msg_1" },
        {
          event: "message-finish",
          finishReason: "incomplete",
          normalizedFinishReason: "length",
          finishState: "complete",
          responseMetadata: { finish_reason: "provider-copy" },
        },
      ])
    );
    const message = await stream.output;
    expect(message.response_metadata).toMatchObject({
      finish_reason: "incomplete",
      normalized_finish_reason: "length",
      finish_state: "complete",
    });
  });

  test("keeps provider finish_reason when event has no raw value", async () => {
    const stream = new ChatModelStream(
      iter<ChatModelStreamEvent>([
        { event: "message-start", id: "msg_1" },
        {
          event: "message-finish",
          responseMetadata: { finish_reason: "stop" },
        },
      ])
    );
    const message = await stream.output;
    expect(message.response_metadata.finish_reason).toBe("stop");
    expect(message.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("maps deprecated reason tool_use to tool_call", async () => {
    const stream = new ChatModelStream(
      iter<ChatModelStreamEvent>([
        { event: "message-start", id: "msg_1" },
        { event: "message-finish", reason: "tool_use" },
      ])
    );
    const message = await stream.output;
    expect(message.response_metadata.normalized_finish_reason).toBe(
      "tool_call"
    );
  });
});

describe("toLegacyFinishReason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["tool_call", "tool_use"],
    ["content_filter", "content_filter"],
    ["refusal", "content_filter"],
    ["context_exceeded", "length"],
    ["other", undefined],
    ["error", undefined],
    [undefined, undefined],
  ] as const)("%s -> %s", (input, expected) => {
    expect(toLegacyFinishReason(input)).toBe(expected);
  });

  test("legacy bridge still emits deprecated reason", async () => {
    const events: ChatModelStreamEvent[] = [];
    for await (const event of convertChunksToEvents(
      iter([
        new ChatGenerationChunk({
          text: "hi",
          message: new AIMessageChunk({
            content: "hi",
            response_metadata: { finish_reason: "length" },
          }),
        }),
      ])
    )) {
      events.push(event);
    }
    const finish = events.at(-1) as MessageFinishEvent;
    expect(finish.reason).toBe("length");
    expect(finish.normalizedFinishReason).toBe("length");
  });
});

describe("refusal override", () => {
  test("refusal block wins over stop", () => {
    expect(normalizeFinishReason("stop", { hasRefusal: true })).toEqual({
      normalizedFinishReason: "refusal",
      finishState: "complete",
    });
  });
});
