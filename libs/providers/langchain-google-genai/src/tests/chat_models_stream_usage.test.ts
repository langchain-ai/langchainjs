import { describe, expect, test, vi, afterEach } from "vitest";
import type { GenerateContentRequest } from "@google/generative-ai";
import { AIMessageChunk } from "@langchain/core/messages";
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

/**
 * Gemini reports usage cumulatively: every chunk carries the running totals
 * for the whole request, not that chunk's own contribution.
 */
function cumulativeUsageStream() {
  return (async function* () {
    yield {
      candidates: [{ content: { parts: [{ text: "$" }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 2,
        thoughtsTokenCount: 100,
        totalTokenCount: 143,
      },
    };
    yield {
      candidates: [{ content: { parts: [{ text: "0." }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 4,
        thoughtsTokenCount: 250,
        totalTokenCount: 295,
      },
    };
    yield {
      candidates: [{ content: { parts: [{ text: "05" }] } }],
      usageMetadata: {
        promptTokenCount: 41,
        candidatesTokenCount: 5,
        thoughtsTokenCount: 381,
        totalTokenCount: 427,
      },
    };
  })();
}

function mockGoogleGenAI(stream: AsyncIterable<Record<string, unknown>>) {
  const model = new ChatGoogleGenerativeAI({
    apiKey: "fake-key",
    model: "gemini-2.5-flash",
  });
  vi.spyOn(getTestClient(model), "generateContentStream").mockResolvedValue({
    stream,
  });
  return model;
}

async function mergedUsage(model: ChatGoogleGenerativeAI) {
  const stream = await model.stream("A bat and a ball cost $1.10 in total.");
  let merged: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    merged = merged ? merged.concat(chunk) : chunk;
  }
  return merged?.usage_metadata;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatGoogleGenerativeAI streaming usage metadata", () => {
  test("reports the final reasoning total, not the sum of the running totals", async () => {
    const usage = await mergedUsage(mockGoogleGenAI(cumulativeUsageStream()));

    // Summing the cumulative per-chunk values would give 100 + 250 + 381 = 731.
    expect(usage?.output_token_details?.reasoning).toBe(381);
  });

  test("counts reasoning tokens toward output_tokens exactly once", async () => {
    const usage = await mergedUsage(mockGoogleGenAI(cumulativeUsageStream()));

    // candidatesTokenCount (5) + thoughtsTokenCount (381)
    expect(usage?.output_tokens).toBe(386);
  });

  test("does not inflate the prompt or total counts", async () => {
    const usage = await mergedUsage(mockGoogleGenAI(cumulativeUsageStream()));

    expect(usage?.input_tokens).toBe(41);
    expect(usage?.total_tokens).toBe(427);
  });

  test("keeps the merged counts internally consistent", async () => {
    const usage = await mergedUsage(mockGoogleGenAI(cumulativeUsageStream()));

    expect((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)).toBe(
      usage?.total_tokens
    );
  });
});
