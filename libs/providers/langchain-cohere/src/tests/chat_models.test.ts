import { describe, expect, test, vi, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk } from "@langchain/core/outputs";
import { ChatCohere } from "../chat_models.js";

function createModel() {
  return new ChatCohere({ apiKey: "fake-key", model: "command-r" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("finish reason response metadata", () => {
  test.each([
    ["COMPLETE", "stop"],
    ["STOP_SEQUENCE", "stop"],
    ["MAX_TOKENS", "length"],
    ["ERROR_LIMIT", "length"],
    ["TOOL_CALL", "tool_call"],
    ["ERROR_TOXIC", "content_filter"],
    ["ERROR", "error"],
    ["SOMETHING_NEW", "other"],
  ])("invoke maps %s to %s", async (finishReason, normalized) => {
    const model = createModel();
    vi.spyOn(model.client, "chat").mockResolvedValue({
      text: "hi",
      finishReason,
    } as never);

    const result = await model.invoke("Hello");

    expect(result.additional_kwargs.finishReason).toBe(finishReason);
    expect(result.response_metadata).toMatchObject({
      finish_reason: finishReason,
      normalized_finish_reason: normalized,
    });
  });

  test("invoke maps COMPLETE with tool calls to tool_call", async () => {
    const model = createModel();
    vi.spyOn(model.client, "chat").mockResolvedValue({
      text: "",
      finishReason: "COMPLETE",
      toolCalls: [{ name: "search", parameters: { query: "weather" } }],
    } as never);

    const result = await model.invoke("Hello");

    expect(result.response_metadata).toMatchObject({
      finish_reason: "COMPLETE",
      normalized_finish_reason: "tool_call",
    });
  });

  test("invoke sets nothing without a finish reason", async () => {
    const model = createModel();
    vi.spyOn(model.client, "chat").mockResolvedValue({
      text: "hi",
    } as never);

    const result = await model.invoke("Hello");

    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets finish keys only on the stream-end chunk", async () => {
    const model = createModel();
    vi.spyOn(model.client, "chatStream").mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { eventType: "stream-start", generationId: "gen_1" };
        yield { eventType: "text-generation", text: "hi" };
        yield {
          eventType: "stream-end",
          finishReason: "MAX_TOKENS",
          response: {
            text: "hi",
            finishReason: "MAX_TOKENS",
            meta: { tokens: { inputTokens: 1, outputTokens: 1 } },
          },
        };
      },
    } as never);

    const chunks: ChatGenerationChunk[] = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hello")],
      {}
    )) {
      chunks.push(chunk);
    }

    const withFinish = chunks.filter(
      (c) => c.message.response_metadata.finish_reason !== undefined
    );
    expect(withFinish).toEqual([chunks[chunks.length - 1]]);
    expect(withFinish[0].message.response_metadata).toMatchObject({
      finish_reason: "MAX_TOKENS",
      normalized_finish_reason: "length",
    });
  });
});
