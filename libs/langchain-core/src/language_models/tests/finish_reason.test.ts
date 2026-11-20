import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import { convertChunksToEvents } from "../compat.js";
import type { ChatModelStreamEvent, MessageFinishEvent } from "../event.js";
import {
  correctFinishReason,
  readFinishFields,
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

const STOP = { finish_reason: "stop", normalized_finish_reason: "stop" };

describe("readFinishFields", () => {
  test("reads provider-set fields", () => {
    expect(
      readFinishFields({
        stop_reason: "pause_turn",
        finish_reason: "pause_turn",
        normalized_finish_reason: "other",
        finish_state: "suspended",
      })
    ).toEqual({
      finishReason: "pause_turn",
      normalizedFinishReason: "other",
      finishState: "suspended",
    });
  });

  test("ignores provider-specific keys", () => {
    expect(readFinishFields({ stop_reason: "end_turn" })).toEqual({});
    expect(readFinishFields({ finishReason: "STOP" })).toEqual({});
    expect(readFinishFields(undefined)).toEqual({});
  });
});

describe("correctFinishReason", () => {
  test("stop with tool calls is tool_call", () => {
    expect(correctFinishReason("stop", { hasToolCalls: true })).toBe(
      "tool_call"
    );
  });

  test("other values are kept with tool calls", () => {
    expect(correctFinishReason("length", { hasToolCalls: true })).toBe(
      "length"
    );
  });

  test("refusal wins", () => {
    expect(correctFinishReason("stop", { hasRefusal: true })).toBe("refusal");
  });

  test("nothing to correct without a provider value", () => {
    expect(correctFinishReason(undefined, { hasRefusal: true })).toBe(
      undefined
    );
  });
});

describe("convertChunksToEvents finish fields", () => {
  test("passes provider fields from generationInfo", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({ content: "" }),
        generationInfo: {
          finish_reason: "length",
          normalized_finish_reason: "length",
        },
      }),
    ]);
    expect(finish).toMatchObject({
      event: "message-finish",
      finishReason: "length",
      normalizedFinishReason: "length",
      reason: "length",
    });
    expect(finish).not.toHaveProperty("finishState");
  });

  test("passes finish state from response_metadata", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          response_metadata: {
            stop_reason: "pause_turn",
            finish_reason: "pause_turn",
            normalized_finish_reason: "other",
            finish_state: "suspended",
          },
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
        }),
      }),
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({ content: "", response_metadata: STOP }),
      }),
    ]);
    expect(finish.finishReason).toBe("stop");
    expect(finish.normalizedFinishReason).toBe("tool_call");
    expect(finish.reason).toBe("tool_use");
  });

  test("refusal overrides stop", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          additional_kwargs: { refusal: "I can't help with that." },
        }),
      }),
      new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({ content: "", response_metadata: STOP }),
      }),
    ]);
    expect(finish.normalizedFinishReason).toBe("refusal");
  });

  test("no provider fields omits finish fields", async () => {
    const finish = await lastEvent([
      new ChatGenerationChunk({
        text: "hi",
        message: new AIMessageChunk({
          content: "hi",
          response_metadata: { stop_reason: "end_turn" },
        }),
      }),
    ]);
    expect(finish).not.toHaveProperty("finishReason");
    expect(finish).not.toHaveProperty("normalizedFinishReason");
    expect(finish.reason).toBeUndefined();
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
});
