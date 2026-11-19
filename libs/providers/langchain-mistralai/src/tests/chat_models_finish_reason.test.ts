import { describe, expect, test, vi } from "vitest";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatMistralAI } from "../chat_models.js";

function completion(finishReason: string | null) {
  return {
    id: "cmpl-1",
    object: "chat.completion",
    model: "mistral-small",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hi" },
        finishReason,
      },
    ],
  };
}

function streamChunks(finishReason: string) {
  return [
    {
      id: "cmpl-1",
      model: "mistral-small",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Hello" },
          finishReason: null,
        },
      ],
    },
    {
      id: "cmpl-1",
      model: "mistral-small",
      choices: [{ index: 0, delta: { content: " world" }, finishReason }],
    },
  ];
}

function mockModel(response: unknown) {
  const model = new ChatMistralAI({
    apiKey: "fake-key",
    model: "mistral-small",
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue(response as never);
  return model;
}

describe("ChatMistralAI finish reason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["model_length", "length"],
    ["tool_calls", "tool_call"],
    ["error", "error"],
    ["something_new", "other"],
  ])("invoke maps %s to %s", async (raw, normalized) => {
    const result = await mockModel(completion(raw)).invoke("Hello");
    expect(result.response_metadata.finishReason).toBe(raw);
    expect(result.response_metadata.finish_reason).toBe(raw);
    expect(result.response_metadata.normalized_finish_reason).toBe(normalized);
  });

  test("invoke sets nothing without a finish reason", async () => {
    const result = await mockModel(completion(null)).invoke("Hello");
    expect(result.response_metadata).not.toHaveProperty("finishReason");
    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets it on the finish chunk only", async () => {
    const model = mockModel({
      async *[Symbol.asyncIterator]() {
        for (const chunk of streamChunks("model_length")) {
          yield { data: chunk };
        }
      },
    });
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await model.stream("Hello")) {
      chunks.push(chunk);
    }
    const withReason = chunks.filter(
      (c) => c.response_metadata.normalized_finish_reason !== undefined
    );
    expect(withReason).toHaveLength(1);
    expect(withReason[0].response_metadata.finish_reason).toBe("model_length");
    expect(withReason[0].response_metadata.normalized_finish_reason).toBe(
      "length"
    );
  });
});
