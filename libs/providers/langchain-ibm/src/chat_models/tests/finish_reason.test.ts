import { describe, expect, test, vi } from "vitest";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatWatsonx } from "../ibm.js";

function makeModel(response: unknown) {
  const model = new ChatWatsonx({
    model: "ibm/granite-13b-chat-v2",
    version: "2024-05-31",
    serviceUrl: "https://test.watsonx.ai",
    projectId: "fake-project",
    watsonxAIAuthType: "iam",
    watsonxAIApikey: "fake-key",
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue(response as never);
  return model;
}

function completion(finishReason: string | undefined) {
  return {
    result: {
      id: "chat-1",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hi" },
          finish_reason: finishReason,
        },
      ],
    },
  };
}

function stream(finishReason: string) {
  const chunks = [
    {
      data: {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello" },
            finish_reason: null,
          },
        ],
      },
    },
    {
      data: {
        choices: [
          {
            index: 0,
            delta: { content: " world" },
            finish_reason: finishReason,
          },
        ],
      },
    },
  ];
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("ChatWatsonx finish reason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["tool_calls", "tool_call"],
    ["content_filter", "content_filter"],
    ["error", "error"],
    ["time_limit", "other"],
    ["cancelled", "other"],
  ])("invoke maps %s to %s", async (raw, normalized) => {
    const result = await makeModel(completion(raw)).invoke("Hello");
    expect(result.response_metadata.finish_reason).toBe(raw);
    expect(result.response_metadata.normalized_finish_reason).toBe(normalized);
  });

  test("invoke sets nothing without a finish reason", async () => {
    const result = await makeModel(completion(undefined)).invoke("Hello");
    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets it on the finish chunk only", async () => {
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await makeModel(stream("tool_calls")).stream(
      "Hello"
    )) {
      chunks.push(chunk);
    }
    const withReason = chunks.filter(
      (c) => c.response_metadata.normalized_finish_reason !== undefined
    );
    expect(withReason).toHaveLength(1);
    expect(withReason[0].response_metadata.finish_reason).toBe("tool_calls");
    expect(withReason[0].response_metadata.normalized_finish_reason).toBe(
      "tool_call"
    );
  });
});
