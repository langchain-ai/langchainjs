import { describe, test, expect } from "vitest";
import { ModelRefusalError } from "@langchain/core/errors";
import { AIMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk } from "@langchain/core/outputs";
import type {
  EnhancedGenerateContentResponse,
  GenerateContentCandidate,
} from "@google/generative-ai";
import {
  convertMessageContentToParts,
  convertResponseContentToChatGenerationChunk,
  mapGenerateContentResultToChatResult,
} from "../utils/common.js";
import { GoogleGenerativeAIToolsOutputParser } from "../output_parsers.js";
import { EmptyContentError } from "../utils/errors.js";

function mockResponse(
  fields: Partial<EnhancedGenerateContentResponse>
): EnhancedGenerateContentResponse {
  return {
    text: () => "",
    functionCall: () => undefined,
    functionCalls: () => undefined,
    ...fields,
  };
}

function catchError(response: EnhancedGenerateContentResponse): unknown {
  try {
    mapGenerateContentResultToChatResult(response);
  } catch (e) {
    return e;
  }
  return expect.fail("should have thrown");
}

function noContentCandidate(finishReason: string): GenerateContentCandidate {
  return {
    finishReason,
    index: 0,
    safetyRatings: [],
  } as unknown as GenerateContentCandidate;
}

describe("refusal errors", () => {
  test("blocked prompt is marked as a refusal", () => {
    const e = catchError(
      mockResponse({
        candidates: [],
        promptFeedback: { blockReason: "SAFETY" } as never,
      })
    );
    expect(e).toBeInstanceOf(EmptyContentError);
    expect(ModelRefusalError.isInstance(e)).toBe(true);
  });

  test("unspecified block reason is not marked as a refusal", () => {
    const e = catchError(
      mockResponse({
        candidates: [],
        promptFeedback: { blockReason: "BLOCKED_REASON_UNSPECIFIED" } as never,
      })
    );
    expect(e).toBeInstanceOf(EmptyContentError);
    expect(ModelRefusalError.isInstance(e)).toBe(false);
  });

  test.each(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"])(
    "%s finish without content is marked as a refusal",
    (finishReason) => {
      const e = catchError(
        mockResponse({ candidates: [noContentCandidate(finishReason)] })
      );
      expect(e).toBeInstanceOf(EmptyContentError);
      expect(ModelRefusalError.isInstance(e)).toBe(true);
    }
  );

  test.each(["RECITATION", "SPII", "MALFORMED_FUNCTION_CALL"])(
    "%s finish without content is not marked as a refusal",
    (finishReason) => {
      const e = catchError(
        mockResponse({ candidates: [noContentCandidate(finishReason)] })
      );
      expect(e).toBeInstanceOf(EmptyContentError);
      expect(ModelRefusalError.isInstance(e)).toBe(false);
    }
  );
});

describe("refusal content blocks in history", () => {
  test("drops refusal blocks and keeps text", () => {
    const message = new AIMessage({
      content: [
        { type: "text", text: "Hello" },
        { type: "refusal", refusal: "No." },
      ],
    });
    const parts = convertMessageContentToParts(message, true, []);
    expect(parts).toEqual([{ text: "Hello" }]);
  });
});

describe("streamed refusals", () => {
  function catchChunkError(response: EnhancedGenerateContentResponse) {
    try {
      return convertResponseContentToChatGenerationChunk(response, {
        index: 0,
      });
    } catch (e) {
      return e;
    }
  }

  test("throws a refusal for a blocked prompt", () => {
    const error = catchChunkError(
      mockResponse({ promptFeedback: { blockReason: "SAFETY" } } as never)
    );
    expect(ModelRefusalError.isInstance(error)).toBe(true);
  });

  test("ends a safety stop with a refusal chunk instead of throwing", () => {
    const chunk = catchChunkError(
      mockResponse({ candidates: [noContentCandidate("SAFETY")] })
    ) as ChatGenerationChunk;

    expect(chunk.generationInfo?.finishReason).toBe("SAFETY");
    const message = new AIMessage({
      content: "",
      response_metadata: {
        ...chunk.generationInfo,
        ...chunk.message.response_metadata,
      },
    });
    expect(message.contentBlocks).toContainEqual(
      expect.objectContaining({ type: "refusal" })
    );
  });

  test("skips other empty chunks", () => {
    expect(catchChunkError(mockResponse({ candidates: [] }))).toBeNull();
    expect(
      catchChunkError(
        mockResponse({ candidates: [noContentCandidate("OTHER")] })
      )
    ).toBeNull();
  });
});

describe("tools output parser", () => {
  test("throws ModelRefusalError on a refusal", async () => {
    const message = new AIMessage({
      content: [],
      response_metadata: {
        model_provider: "google-genai",
        finishReason: "SAFETY",
      },
    });
    const parser = new GoogleGenerativeAIToolsOutputParser({
      keyName: "extract",
      returnSingle: true,
    });

    const error = await parser
      .parseResult([{ text: "", message }])
      .catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
  });
});
