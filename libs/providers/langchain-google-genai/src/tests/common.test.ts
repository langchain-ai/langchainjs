import { describe, test, expect } from "vitest";
import {
  convertResponseContentToChatGenerationChunk,
  convertMessageContentToParts,
  convertUsageMetadata,
  mapGenerateContentResultToChatResult,
} from "../utils/common.js";
import { EmptyContentError } from "../utils/errors.js";
import { AIMessage } from "@langchain/core/messages";
import type {
  EnhancedGenerateContentResponse,
  FinishReason,
  GenerateContentCandidate,
} from "@google/generative-ai";
import type { GoogleGenerativeAIPart } from "../types.js";

type ThinkingBlock = { type: "thinking"; thinking: string; signature?: string };
type TextBlock = { type: "text"; text: string };

function createMockResponse(
  candidates: GenerateContentCandidate[]
): EnhancedGenerateContentResponse {
  return {
    candidates,
    text: () => {
      const parts = candidates[0]?.content?.parts ?? [];
      return parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("");
    },
    functionCall: () => undefined,
    functionCalls: () => undefined,
  };
}

// https://github.com/langchain-ai/langchainjs/issues/9724
describe("Thinking content handling", () => {
  test("should separate thinking and text content blocks", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Let me think about this...",
              thought: true,
              thoughtSignature: "abc123",
            },
            {
              text: "The answer is 4.",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);

    expect(result.generations).toHaveLength(1);
    const content = result.generations[0].message.content;

    // Content should be an array
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content.length).toBe(2);

    // First block should be thinking type
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Let me think about this...");
    expect(thinkingBlock.signature).toBe("abc123");

    // Second block should be text type
    const textBlock = content[1] as TextBlock;
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("The answer is 4.");
  });

  test("should handle thinking blocks without signatures", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking content",
              thought: true,
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);
    const content = result.generations[0].message.content;

    if (!Array.isArray(content)) return;
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Thinking content");
    expect(thinkingBlock.signature).toBeUndefined();
  });

  test("should handle regular text without thought flag", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Regular response",
            },
          ],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);

    // When there's only one text part, it should be a string
    expect(typeof result.generations[0].message.content).toBe("string");
    expect(result.generations[0].message.content).toBe("Regular response");
  });
});

describe("Streaming thinking content handling", () => {
  test("should separate thinking and text content blocks in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Let me think about this...",
              thought: true,
              thoughtSignature: "abc123",
            },
            {
              text: "The answer is 4.",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    // Content should be an array with separate blocks
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content.length).toBe(2);

    // First block should be thinking type
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Let me think about this...");
    expect(thinkingBlock.signature).toBe("abc123");

    // Second block should be text type
    const textBlock = content[1] as TextBlock;
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("The answer is 4.");
  });

  test("should handle thinking blocks without signatures in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking content",
              thought: true,
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    if (!Array.isArray(content)) return;
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Thinking content");
    expect(thinkingBlock.signature).toBeUndefined();
  });

  test("should handle regular text without thought flag in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Regular response",
            },
          ],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    // When all parts are plain text (no thought flag), it should be a string
    expect(typeof result!.message.content).toBe("string");
    expect(result!.message.content).toBe("Regular response");
  });

  test("should not concatenate thinking and text into string in streaming", () => {
    // This test verifies the fix for the bug where thinking+text was concatenated
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking...",
              thought: true,
            },
            {
              text: "Answer",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    // Should NOT be a concatenated string like "Thinking...Answer"
    expect(typeof content).not.toBe("string");
    expect(Array.isArray(content)).toBe(true);
  });
});

// https://github.com/langchain-ai/langchainjs/issues/10103
describe("Round-trip thinking content handling", () => {
  test("thinking block with signature converts back to Gemini part", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Let me reason about this...",
          signature: "sig123",
        },
        { type: "text", text: "The answer is 42." },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      text: "Let me reason about this...",
      thought: true,
      thoughtSignature: "sig123",
    });
    expect(parts[1]).toEqual({ text: "The answer is 42." });
  });

  test("thinking block without signature converts back without thoughtSignature", () => {
    const message = new AIMessage({
      content: [
        { type: "thinking", thinking: "Some thinking" },
        { type: "text", text: "Some answer" },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      text: "Some thinking",
      thought: true,
    });
    expect(parts[0]).not.toHaveProperty("thoughtSignature");
    expect(parts[1]).toEqual({ text: "Some answer" });
  });

  test("thinking-only content (no text block) works", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Only thinking, no answer",
          signature: "sigABC",
        },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      text: "Only thinking, no answer",
      thought: true,
      thoughtSignature: "sigABC",
    });
  });

  test("full round-trip: Gemini response -> LangChain -> Gemini parts", () => {
    const originalParts = [
      {
        text: "Let me think step by step...",
        thought: true,
        thoughtSignature: "roundtrip-sig",
      },
      {
        text: "The final answer is 7.",
      },
    ] as GoogleGenerativeAIPart[];

    // Gemini response -> LangChain AIMessage
    const mockResponse = createMockResponse([
      {
        content: { role: "model", parts: originalParts },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const chatResult = mapGenerateContentResultToChatResult(mockResponse);
    const aiMessage = chatResult.generations[0].message;

    // LangChain AIMessage -> Gemini parts (outgoing direction)
    const roundTrippedParts = convertMessageContentToParts(aiMessage, true, []);

    expect(roundTrippedParts).toHaveLength(2);
    expect(roundTrippedParts[0]).toEqual({
      text: "Let me think step by step...",
      thought: true,
      thoughtSignature: "roundtrip-sig",
    });
    expect(roundTrippedParts[1]).toEqual({
      text: "The final answer is 7.",
    });
  });
});

describe("Missing candidate content", () => {
  test("mapGenerateContentResultToChatResult throws when a candidate has no content", () => {
    const mockResponse = createMockResponse([
      {
        // Real Gemini responses omit `content` entirely when generation is
        // cut short (e.g. a malformed function call); the SDK's type says
        // it's required, but at runtime it isn't.
        finishReason: "MALFORMED_FUNCTION_CALL" as FinishReason,
        index: 0,
        safetyRatings: [],
      } as unknown as GenerateContentCandidate,
    ]);

    try {
      mapGenerateContentResultToChatResult(mockResponse);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(EmptyContentError);
      expect((e as EmptyContentError).finishReason).toBe(
        "MALFORMED_FUNCTION_CALL"
      );
    }
  });

  test("mapGenerateContentResultToChatResult throws when there are no candidates at all", () => {
    const mockResponse: EnhancedGenerateContentResponse = {
      candidates: [],
      promptFeedback: { blockReason: "SAFETY" } as never,
      text: () => "",
      functionCall: () => undefined,
      functionCalls: () => undefined,
    };

    try {
      mapGenerateContentResultToChatResult(mockResponse);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(EmptyContentError);
      expect((e as EmptyContentError).blockReason).toBe("SAFETY");
    }
  });

  test("convertResponseContentToChatGenerationChunk returns null when a candidate has no content (streaming)", () => {
    const mockResponse = createMockResponse([
      {
        finishReason: "SAFETY" as FinishReason,
        index: 0,
        safetyRatings: [],
      } as unknown as GenerateContentCandidate,
    ]);

    expect(() =>
      convertResponseContentToChatGenerationChunk(mockResponse, { index: 0 })
    ).not.toThrow();
    expect(
      convertResponseContentToChatGenerationChunk(mockResponse, { index: 0 })
    ).toBeNull();
  });
});

// `thoughtsTokenCount` is returned by the API for thinking models but is not
// declared on the legacy `@google/generative-ai` `UsageMetadata` type.
type UsageWithThoughts = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
};

const usage = (u: UsageWithThoughts) =>
  u as Parameters<typeof convertUsageMetadata>[0];

describe("convertUsageMetadata reasoning tokens", () => {
  test("reports reasoning tokens returned by thinking models", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 41,
        candidatesTokenCount: 5,
        thoughtsTokenCount: 381,
        totalTokenCount: 427,
      }),
      "gemini-2.5-flash"
    );

    expect(result.output_token_details?.reasoning).toBe(381);
  });

  test("counts reasoning tokens toward output_tokens", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 41,
        candidatesTokenCount: 5,
        thoughtsTokenCount: 381,
        totalTokenCount: 427,
      }),
      "gemini-2.5-flash"
    );

    // `output_tokens` is documented as the sum of all output token types, and
    // Gemini reports reasoning separately from `candidatesTokenCount`.
    expect(result.output_tokens).toBe(386);
  });

  test("keeps the token counts internally consistent", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 41,
        candidatesTokenCount: 5,
        thoughtsTokenCount: 381,
        totalTokenCount: 427,
      }),
      "gemini-2.5-flash"
    );

    expect(result.input_tokens + result.output_tokens).toBe(
      result.total_tokens
    );
  });

  test("omits reasoning details when the model does not think", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      }),
      "gemini-2.5-flash"
    );

    expect(result.output_tokens).toBe(20);
    expect(result.output_token_details?.reasoning).toBeUndefined();
  });
});

describe("convertUsageMetadata 200k bracket tracking", () => {
  test("does not report an overage for prompts under 200k", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 500,
        candidatesTokenCount: 10,
        cachedContentTokenCount: 100,
        totalTokenCount: 510,
      }),
      "gemini-3-pro-preview"
    );

    expect(result.input_token_details?.over_200k).toBeUndefined();
    expect(result.input_token_details?.cache_read_over_200k).toBeUndefined();
  });

  test("reports only the amount above 200k", () => {
    const result = convertUsageMetadata(
      usage({
        promptTokenCount: 250000,
        candidatesTokenCount: 10,
        cachedContentTokenCount: 220000,
        totalTokenCount: 250010,
      }),
      "gemini-3-pro-preview"
    );

    expect(result.input_token_details?.over_200k).toBe(50000);
    expect(result.input_token_details?.cache_read_over_200k).toBe(20000);
  });
});
