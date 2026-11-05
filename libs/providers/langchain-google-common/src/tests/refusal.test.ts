import { describe, expect, test } from "vitest";
import { ModelRefusalError } from "@langchain/core/errors";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getGeminiAPI } from "../utils/gemini.js";
import { GoogleAISafetyError } from "../utils/safety.js";
import type { GeminiRequest, GoogleLLMResponse } from "../types.js";

function catchError(data: Record<string, unknown>): unknown {
  const response = { data } as unknown as GoogleLLMResponse;
  try {
    getGeminiAPI().responseToBaseMessage(response);
  } catch (e) {
    return e;
  }
  return expect.fail("should have thrown");
}

function finishedWith(finishReason: string): Record<string, unknown> {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text: "partial" }] },
        finishReason,
      },
    ],
  };
}

describe("refusal errors", () => {
  test("blocked prompt is marked as a refusal", () => {
    const e = catchError({ promptFeedback: { blockReason: "SAFETY" } });
    expect(e).toBeInstanceOf(GoogleAISafetyError);
    expect(ModelRefusalError.isInstance(e)).toBe(true);
  });

  test("unspecified block reason is not marked as a refusal", () => {
    const e = catchError({
      promptFeedback: { blockReason: "BLOCK_REASON_UNSPECIFIED" },
    });
    expect(e).toBeInstanceOf(GoogleAISafetyError);
    expect(ModelRefusalError.isInstance(e)).toBe(false);
  });

  test("SAFETY finish is marked as a refusal with the reply message", () => {
    const e = catchError(finishedWith("SAFETY"));
    expect(e).toBeInstanceOf(GoogleAISafetyError);
    expect(ModelRefusalError.isInstance(e)).toBe(true);
    const { rawMessage } = e as { rawMessage?: unknown };
    expect(AIMessage.isInstance(rawMessage)).toBe(true);
    expect((rawMessage as AIMessage).text).toBe("partial");
  });

  test.each(["RECITATION", "OTHER"])(
    "%s finish is not marked as a refusal",
    (finishReason) => {
      const e = catchError(finishedWith(finishReason));
      expect(e).toBeInstanceOf(GoogleAISafetyError);
      expect(ModelRefusalError.isInstance(e)).toBe(false);
    }
  );
});

describe("refusal content blocks in history", () => {
  test("drops refusal blocks and keeps text", async () => {
    const request = (await getGeminiAPI().formatData(
      [
        new HumanMessage("Hi"),
        new AIMessage({
          content: [
            { type: "text", text: "Hello" },
            { type: "refusal", refusal: "No." },
          ],
        }),
        new HumanMessage("Why?"),
      ],
      {}
    )) as GeminiRequest;
    expect(request.contents?.[1]).toEqual({
      role: "model",
      parts: [{ text: "Hello" }],
    });
  });
});
