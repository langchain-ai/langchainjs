import { describe, expect, test, vi } from "vitest";
import type { AIMessageChunk } from "@langchain/core/messages";
import { asAsyncIterable } from "@langchain/core/testing";
import { ChatGroq } from "../chat_models.js";

function completion(finishReason: string | null) {
  return {
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 0,
    model: "llama-3.1-8b-instant",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hi" },
        finish_reason: finishReason,
        logprobs: null,
      },
    ],
  };
}

function streamChunks(finishReason: string) {
  const base = {
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 0,
    model: "llama-3.1-8b-instant",
  };
  return [
    {
      ...base,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Hi" },
          finish_reason: null,
        },
      ],
    },
    {
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    },
  ];
}

function mockModel(response: unknown) {
  const model = new ChatGroq({
    apiKey: "fake-key",
    model: "llama-3.1-8b-instant",
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue(response as never);
  return model;
}

describe("ChatGroq finish reason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["tool_calls", "tool_call"],
    ["function_call", "tool_call"],
    ["content_filter", "content_filter"],
    ["something_new", "other"],
  ])("invoke maps %s to %s", async (raw, normalized) => {
    const result = await mockModel(completion(raw)).invoke("Hello");
    expect(result.response_metadata.finish_reason).toBe(raw);
    expect(result.response_metadata.normalized_finish_reason).toBe(normalized);
  });

  test("invoke sets nothing without a finish reason", async () => {
    const result = await mockModel(completion(null)).invoke("Hello");
    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets it on the finish chunk only", async () => {
    const model = mockModel(asAsyncIterable(streamChunks("length")));
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await model.stream("Hello")) {
      chunks.push(chunk);
    }
    const withReason = chunks.filter(
      (c) => c.response_metadata.normalized_finish_reason !== undefined
    );
    expect(withReason).toHaveLength(1);
    expect(withReason[0].response_metadata.finish_reason).toBe("length");
    expect(withReason[0].response_metadata.normalized_finish_reason).toBe(
      "length"
    );
  });
});
