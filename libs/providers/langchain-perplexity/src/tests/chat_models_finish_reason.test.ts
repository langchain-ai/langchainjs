import { describe, expect, test, vi } from "vitest";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatPerplexity } from "../chat_models.js";

function mockModel(response: unknown) {
  const model = new ChatPerplexity({ model: "sonar", apiKey: "test-key" });
  const { client } = model as unknown as {
    client: { chat: { completions: { create: () => Promise<unknown> } } };
  };
  vi.spyOn(client.chat.completions, "create").mockResolvedValue(response);
  return model;
}

function completion(finishReason: string | undefined) {
  return {
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hi" },
        finish_reason: finishReason,
      },
    ],
  };
}

async function* stream(finishReason: string) {
  yield {
    choices: [
      { delta: { role: "assistant", content: "Hello" }, finish_reason: null },
    ],
  };
  yield { choices: [{ delta: { content: "!" }, finish_reason: finishReason }] };
}

describe("ChatPerplexity finish reason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["tool_calls", "tool_call"],
    ["content_filter", "content_filter"],
    ["something_new", "other"],
  ])("invoke maps %s to %s", async (raw, normalized) => {
    const result = await mockModel(completion(raw)).invoke("Hello");
    expect(result.response_metadata.finish_reason).toBe(raw);
    expect(result.response_metadata.normalized_finish_reason).toBe(normalized);
  });

  test("invoke sets nothing without a finish reason", async () => {
    const result = await mockModel(completion(undefined)).invoke("Hello");
    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets it on the finish chunk only", async () => {
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await mockModel(stream("length")).stream(
      "Hello"
    )) {
      chunks.push(chunk);
    }
    const withReason = chunks.filter(
      (c) => c.response_metadata.normalized_finish_reason !== undefined
    );
    expect(withReason).toHaveLength(1);
    expect(withReason[0].response_metadata.finish_reason).toBe("length");
    expect(withReason[0].response_metadata.finishReason).toBe("length");
    expect(withReason[0].response_metadata.normalized_finish_reason).toBe(
      "length"
    );
  });
});
