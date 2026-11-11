/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod/v4";
import { AIMessage } from "@langchain/core/messages";
import { ModelRefusalError } from "@langchain/core/errors";
import { ChatAnthropic } from "../chat_models.js";
import { AnthropicToolsOutputParser } from "../output_parsers.js";
import { convertAnthropicStream } from "../utils/stream_events.js";

function refusedMessage() {
  return new AIMessage({
    content: [],
    response_metadata: {
      model_provider: "anthropic",
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "No." },
    },
  });
}

describe("Anthropic refusals", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps a refusal stop reason to content_filter in stream events", async () => {
    const source = (async function* () {
      yield {
        type: "message_start",
        message: {
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-sonnet-5-5",
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      };
      yield {
        type: "message_delta",
        delta: { stop_reason: "refusal", stop_sequence: null },
        usage: { output_tokens: 1 },
      };
      yield { type: "message_stop" };
    })();
    const events: any[] = [];
    for await (const event of convertAnthropicStream(source as any)) {
      events.push(event);
    }

    const finish = events.find((event) => event.event === "message-finish");
    expect(finish.reason).toBe("content_filter");
  });

  it("raises ModelRefusalError from the tools output parser", async () => {
    const message = refusedMessage();
    const parser = new AnthropicToolsOutputParser({
      keyName: "extract",
      returnSingle: true,
    });

    const error = await parser
      .parseResult([{ text: "", message }])
      .catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
    expect((error as ModelRefusalError).rawMessage).toBe(message);
  });

  it("raises ModelRefusalError from structured output with thinking", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(ChatAnthropic.prototype as any, "_generate").mockResolvedValue({
      generations: [{ text: "", message: refusedMessage() }],
    });
    const model = new ChatAnthropic({
      model: "claude-sonnet-5-5",
      apiKey: "test",
      thinking: { type: "adaptive" },
    });
    const structured = model.withStructuredOutput(
      z.object({ answer: z.string() })
    );

    const error = await structured.invoke("Hi").catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
  });
});
