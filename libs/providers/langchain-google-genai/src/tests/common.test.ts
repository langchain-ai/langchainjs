import { describe, test, expect } from "vitest";
import {
  convertResponseContentToChatGenerationChunk,
  convertMessageContentToParts,
  mapGenerateContentResultToChatResult,
} from "../utils/common.js";
import { EmptyContentError } from "../utils/errors.js";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
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

// https://github.com/langchain-ai/langchainjs/issues/11444#issuecomment-thought-signature-followup
//
// Gemini can omit `functionCall.id` on a streaming delta that continues a
// tool call started in an earlier chunk (only the first delta is guaranteed
// to carry the real id). When that happens, `convertResponseContentToChatGenerationChunk`
// falls back to a freshly generated uuid for that delta's tool_call_chunk id
// (see the `uuidv4()` fallback in `common.ts`). Because the per-chunk
// thoughtSignature map is keyed by that same id, the signature ends up
// stored under a random id that never matches the final, merged tool call's
// real id -- so it is silently unreachable once the stream is fully
// consumed and `AIMessageChunk.concat()` has combined all the deltas.
describe("streaming function-call thoughtSignature survives chunk merging", () => {
  test("thoughtSignature stays attached to its tool call once all stream chunks are concatenated", () => {
    // Delta 1: the tool call starts here and carries its real id, no
    // signature yet.
    const delta1 = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              functionCall: { id: "call_1", name: "get_weather", args: {} },
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: undefined as unknown as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    // Delta 2: a continuation of the SAME call. Gemini omits `id` on this
    // delta (as it does for continuations), and this is the delta that
    // carries the thoughtSignature.
    const delta2 = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              functionCall: { name: "get_weather", args: { city: "SF" } },
              thoughtSignature: "sig-xyz",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const chunk1 = convertResponseContentToChatGenerationChunk(delta1, {
      index: 0,
    });
    const chunk2 = convertResponseContentToChatGenerationChunk(delta2, {
      index: 0,
    });
    expect(chunk1).not.toBeNull();
    expect(chunk2).not.toBeNull();

    // This is exactly what the real streaming path does: fold each raw
    // chunk into the running AIMessageChunk via `.concat()`.
    const merged = (chunk1!.message as AIMessageChunk).concat(
      chunk2!.message as AIMessageChunk
    );

    const finalCallId = merged.tool_calls?.[0]?.id;
    const signatureMap = (
      merged.additional_kwargs as Record<
        string,
        Record<string, string> | undefined
      >
    ).__gemini_function_call_thought_signatures__;

    // The signature Gemini sent must be retrievable under the id of the
    // tool call it actually belongs to once the stream is fully merged.
    expect(finalCallId).toBeDefined();
    expect(signatureMap?.[finalCallId as string]).toBe("sig-xyz");
  });
});
