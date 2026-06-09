import { describe, expect, test, vi } from "vitest";
import { ChatWatsonx } from "../ibm.js";

function watsonxTextChunks() {
  return [
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
            finish_reason: "stop",
          },
        ],
      },
    },
  ];
}

function watsonxReasoningChunks() {
  return [
    {
      data: {
        choices: [
          {
            index: 0,
            delta: { reasoning: "Let me reason..." },
            finish_reason: null,
          },
        ],
      },
    },
    {
      data: {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      },
    },
  ];
}

function watsonxToolChunks() {
  return [
    {
      data: {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Let me search." },
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
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "web_search",
                    arguments: '{"query":"weather"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
    },
  ];
}

function watsonxUsageChunks() {
  return [
    {
      data: {
        id: "wx-1",
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 2,
          total_tokens: 7,
        },
      },
    },
  ];
}

function mockWatsonx(chunks: { data: Record<string, unknown> }[]) {
  const model = new ChatWatsonx({
    model: "ibm/granite-13b-chat-v2",
    version: "2024-05-31",
    serviceUrl: "https://test.watsonx.ai",
    projectId: "fake-project",
    watsonxAIAuthType: "iam",
    watsonxAIApikey: "fake-key",
    streaming: true,
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as never);
  return model;
}

describe("ChatWatsonx.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockWatsonx(watsonxTextChunks()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockWatsonx(watsonxReasoningChunks()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockWatsonx(watsonxToolChunks()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockWatsonx(watsonxUsageChunks()).streamV2("Hello")
    ).toHaveStreamUsage({
      input_tokens: 5,
      output_tokens: 2,
      total_tokens: 7,
    });
  });
});
