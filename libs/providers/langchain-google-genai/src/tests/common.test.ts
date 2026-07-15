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

// https://github.com/langchain-ai/langchainjs/issues/11180
describe("Round-trip standard v1 reasoning content handling", () => {
  test("reasoning block converts back to Gemini thought part", () => {
    const message = new AIMessage({
      content: [
        { type: "reasoning", reasoning: "Let me reason about this..." },
        { type: "text", text: "The answer is 42." },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      text: "Let me reason about this...",
      thought: true,
    });
    expect(parts[0]).not.toHaveProperty("thoughtSignature");
    expect(parts[1]).toEqual({ text: "The answer is 42." });
  });

  test("reasoning block with signature keeps thoughtSignature", () => {
    const message = new AIMessage({
      content: [
        {
          type: "reasoning",
          reasoning: "Signed reasoning",
          signature: "sig456",
        },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      text: "Signed reasoning",
      thought: true,
      thoughtSignature: "sig456",
    });
  });

  test("multi-turn replay: v1 AIMessage with reasoning and tool_call serializes", () => {
    // Shape produced by core's v1 output pipeline (output_version: "v1"),
    // e.g. when replaying checkpointed agent history.
    const message = new AIMessage({
      content: [
        { type: "reasoning", reasoning: "thinking about it" },
        {
          type: "tool_call",
          id: "tc-1",
          name: "get_weather",
          args: { city: "Paris" },
        },
      ],
      tool_calls: [
        { name: "get_weather", args: { city: "Paris" }, id: "tc-1" },
      ],
      response_metadata: {
        output_version: "v1",
        model_provider: "google-genai",
        finish_reason: "stop",
      },
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts[0]).toEqual({
      text: "thinking about it",
      thought: true,
    });
    const functionCallParts = parts.filter((p) => "functionCall" in p);
    expect(functionCallParts.length).toBeGreaterThanOrEqual(1);
    expect(
      (functionCallParts[0] as { functionCall: { name: string } }).functionCall
        .name
    ).toBe("get_weather");
  });
});
