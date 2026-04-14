import { describe, test, expect } from "vitest";
import {
  convertResponseContentToChatGenerationChunk,
  convertMessageContentToParts,
  mapGenerateContentResultToChatResult,
} from "../utils/common.js";
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
