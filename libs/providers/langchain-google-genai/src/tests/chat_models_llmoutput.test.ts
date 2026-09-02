import { describe, expect, test, vi, afterEach } from "vitest";
import type { GenerateContentRequest } from "@google/generative-ai";
import type { LLMResult } from "@langchain/core/outputs";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

type TestGoogleGenAIClient = {
  generateContentStream: (
    request: GenerateContentRequest,
    options?: unknown
  ) => Promise<{ stream: AsyncIterable<Record<string, unknown>> }>;
};

function getTestClient(model: ChatGoogleGenerativeAI): TestGoogleGenAIClient {
  return (model as unknown as { client: TestGoogleGenAIClient }).client;
}

/** Gemini reports usage cumulatively on every streamed chunk. */
function cumulativeUsageStream() {
  return (async function* () {
    yield {
      candidates: [{ content: { parts: [{ text: "$" }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 2,
        totalTokenCount: 143,
      },
    };
    yield {
      candidates: [{ content: { parts: [{ text: "0." }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 4,
        totalTokenCount: 295,
      },
    };
    yield {
      candidates: [{ content: { parts: [{ text: "05" }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 5,
        totalTokenCount: 427,
      },
    };
  })();
}

async function llmOutputFromStreamingInvoke() {
  const model = new ChatGoogleGenerativeAI({
    apiKey: "fake-key",
    model: "gemini-2.5-flash",
    streaming: true,
  });
  vi.spyOn(getTestClient(model), "generateContentStream").mockResolvedValue({
    stream: cumulativeUsageStream(),
  });

  let captured: LLMResult | undefined;
  const result = await model.invoke("A bat and a ball cost $1.10 in total.", {
    callbacks: [
      {
        handleLLMEnd(output: LLMResult) {
          captured = output;
        },
      },
    ],
  });

  return { llmOutput: captured?.llmOutput, usage: result.usage_metadata };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("llmOutput on the streaming _generate path", () => {
  test("reports token usage under the same key as the non-streaming path", async () => {
    const { llmOutput } = await llmOutputFromStreamingInvoke();

    expect(llmOutput?.tokenUsage).toBeDefined();
  });

  test("agrees with the message usage metadata", async () => {
    const { llmOutput, usage } = await llmOutputFromStreamingInvoke();

    expect(llmOutput?.tokenUsage).toEqual({
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
      totalTokens: usage?.total_tokens,
    });
  });

  test("does not report an empty usage object", async () => {
    const { llmOutput } = await llmOutputFromStreamingInvoke();

    expect(Object.keys(llmOutput?.tokenUsage ?? {})).not.toHaveLength(0);
  });
});
