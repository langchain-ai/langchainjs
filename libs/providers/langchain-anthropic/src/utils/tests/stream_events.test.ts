import { test, expect, describe } from "vitest";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import { convertAnthropicStream } from "../stream_events.js";

interface StreamOverrides {
  cost?: unknown;
  streamUsage?: boolean;
}

/** One response's raw Anthropic events, optionally with a gateway `cost` on the terminal usage. */
function rawEvents({ cost }: StreamOverrides = {}) {
  return [
    {
      type: "message_start" as const,
      message: {
        id: "msg_01",
        type: "message" as const,
        role: "assistant" as const,
        content: [],
        model: "claude-3-5-haiku-latest",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 1 },
      },
    },
    {
      type: "content_block_start" as const,
      index: 0,
      content_block: { type: "text" as const, text: "" },
    },
    {
      type: "content_block_delta" as const,
      index: 0,
      delta: { type: "text_delta" as const, text: "hello" },
    },
    { type: "content_block_stop" as const, index: 0 },
    {
      type: "message_delta" as const,
      delta: { stop_reason: "end_turn" as const, stop_sequence: null },
      usage: {
        output_tokens: 42,
        ...(cost === undefined ? {} : { cost }),
      },
    },
    { type: "message_stop" as const },
  ];
}

async function convert({ cost, streamUsage }: StreamOverrides = {}) {
  const source = (async function* () {
    yield* rawEvents({ cost });
  })();
  const events = [];
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const event of convertAnthropicStream(source as any, {
    streamUsage,
  })) {
    events.push(event);
  }
  return events;
}

function messageFinish(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  events: any[]
) {
  return events.find((event) => event.event === "message-finish");
}

describe("convertAnthropicStream", () => {
  test("surfaces a gateway-provided cost on the message-finish response metadata", async () => {
    const events = await convert({ cost: 0.0123 });

    expect(messageFinish(events).responseMetadata).toEqual({
      usage: { cost: 0.0123 },
    });
  });

  test("adds no response metadata when no cost is present", async () => {
    const events = await convert();

    expect(messageFinish(events).responseMetadata).toEqual({});
  });

  test.each([
    { case: "a nonnumeric cost", cost: "0.0123" },
    { case: "a null cost", cost: null },
  ])("ignores $case", async ({ cost }) => {
    const events = await convert({ cost });

    expect(messageFinish(events).responseMetadata).toEqual({});
  });

  test("leaves the rest of the message-finish event untouched", async () => {
    const events = await convert({ cost: 0.0123 });

    expect(messageFinish(events).reason).toBe("stop");
    expect(messageFinish(events).metadata).toEqual({
      model_provider: "anthropic",
    });
  });

  test("preserves the cost when streamUsage is false", async () => {
    const events = await convert({ cost: 0.0123, streamUsage: false });

    expect(messageFinish(events).responseMetadata).toEqual({
      usage: { cost: 0.0123 },
    });
    expect(messageFinish(events).usage).toBeUndefined();
  });

  test("leaves token accounting untouched", async () => {
    const events = await convert({ cost: 0.0123 });

    // Cost is not token accounting, so it must not leak into the usage snapshots.
    expect(messageFinish(events).usage).toEqual({
      input_tokens: 100,
      output_tokens: 43,
      total_tokens: 143,
      input_token_details: { cache_creation: 0, cache_read: 0 },
    });
    for (const event of events.filter((event) => event.usage)) {
      expect(event.usage).not.toHaveProperty("cost");
    }
  });

  test("an empty response metadata leaves the assembled message alone", async () => {
    const source = (async function* () {
      yield* rawEvents();
    })();
    const message = await new ChatModelStream(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      convertAnthropicStream(source as any) as any
    );

    expect(message.response_metadata).not.toHaveProperty("usage");
  });

  test("the cost reaches the assembled message", async () => {
    const source = (async function* () {
      yield* rawEvents({ cost: 0.0123 });
    })();
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await new ChatModelStream(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      convertAnthropicStream(source as any) as any
    );

    expect(message.response_metadata.usage).toEqual({ cost: 0.0123 });
    expect(message.usage_metadata?.output_tokens).toBe(43);
  });
});
