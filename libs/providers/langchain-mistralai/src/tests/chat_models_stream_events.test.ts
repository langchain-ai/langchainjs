import { describe, expect, test, vi } from "vitest";
import {
  ChatMistralAI,
  type ChatMistralAICallOptions,
} from "../chat_models.js";

function mistralTextChunks() {
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
      choices: [
        {
          index: 0,
          delta: { content: " world" },
          finishReason: null,
        },
      ],
    },
    {
      id: "cmpl-1",
      model: "mistral-small",
      choices: [{ index: 0, delta: {}, finishReason: "stop" }],
    },
  ];
}

function mistralReasoningChunks() {
  return [
    {
      choices: [
        {
          index: 0,
          delta: { role: "assistant", reasoning: "Let me reason..." },
          finishReason: null,
        },
      ],
    },
    {
      choices: [{ index: 0, delta: {}, finishReason: "stop" }],
    },
  ];
}

function mistralToolChunks() {
  return [
    {
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Let me search." },
          finishReason: null,
        },
      ],
    },
    {
      choices: [
        {
          index: 0,
          delta: {
            toolCalls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "web_search", arguments: '{"query"' },
              },
            ],
          },
          finishReason: null,
        },
      ],
    },
    {
      choices: [
        {
          index: 0,
          delta: {
            toolCalls: [
              {
                index: 0,
                type: "function",
                function: { arguments: ':"weather"}' },
              },
            ],
          },
          finishReason: "tool_calls",
        },
      ],
    },
  ];
}

function mockMistral(chunks: Record<string, unknown>[]) {
  const model = new ChatMistralAI({
    apiKey: "fake-key",
    model: "mistral-small",
    streaming: true,
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield { data: chunk };
      }
    },
  } as never);
  return model;
}

function mistralUsageChunks() {
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
      usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
    },
  ];
}

describe("ChatMistralAI.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockMistral(mistralTextChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("per-call streamUsage false wins over instance default true", async () => {
    const model = mockMistral(mistralUsageChunks());
    const chunks = [];
    for await (const chunk of model._streamResponseChunks([], {
      streamUsage: false,
    } as ChatMistralAICallOptions)) {
      chunks.push(chunk);
    }
    expect(
      chunks.some(
        (chunk) => chunk.message.usage_metadata !== undefined
      )
    ).toBe(false);
  });

  test("per-call streamUsage true wins over instance false", async () => {
    const model = mockMistral(mistralUsageChunks());
    model.streamUsage = false;
    const chunks = [];
    for await (const chunk of model._streamResponseChunks([], {
      streamUsage: true,
    } as ChatMistralAICallOptions)) {
      chunks.push(chunk);
    }
    const usageChunk = chunks.find(
      (chunk) => chunk.message.usage_metadata !== undefined
    );
    expect(usageChunk?.message.usage_metadata).toEqual({
      input_tokens: 4,
      output_tokens: 2,
      total_tokens: 6,
    });
  });

  test("streams reasoning", async () => {
    await expect(
      mockMistral(mistralReasoningChunks()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockMistral(mistralToolChunks()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
