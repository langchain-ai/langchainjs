import { describe, expect, test, vi } from "vitest";
import { ChatMistralAI } from "../chat_models.js";

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

describe("ChatMistralAI.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockMistral(mistralTextChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
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

describe("ChatMistralAI streamUsage call option", () => {
  function usageChunks() {
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
        choices: [{ index: 0, delta: {}, finishReason: "stop" }],
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
      },
    ];
  }

  async function collectUsage(
    model: ChatMistralAI,
    streamUsage: boolean
  ): Promise<unknown[]> {
    const usages: unknown[] = [];
    for await (const chunk of await model.stream("Hello", { streamUsage })) {
      if (chunk.usage_metadata) usages.push(chunk.usage_metadata);
    }
    return usages;
  }

  test("call option streamUsage: false overrides the instance default", async () => {
    const model = mockMistral(usageChunks());
    expect(model.streamUsage).toBe(true);

    expect(await collectUsage(model, false)).toEqual([]);
  });

  test("call option streamUsage: true overrides an instance streamUsage of false", async () => {
    const model = mockMistral(usageChunks());
    model.streamUsage = false;

    expect(await collectUsage(model, true)).toEqual([
      { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
    ]);
  });
});
