import { describe, expect, test } from "vitest";
import type { GoogleLLMResponse } from "../../types.js";
import { getGeminiAPI } from "../gemini.js";

const api = getGeminiAPI({ safetyHandler: { handle: (response) => response } });

function response(
  parts: Record<string, unknown>[],
  finishReason?: string
): GoogleLLMResponse {
  return {
    data: {
      candidates: [
        {
          content: { role: "model", parts },
          ...(finishReason ? { finishReason } : {}),
        },
      ],
    },
  } as unknown as GoogleLLMResponse;
}

const textParts = [{ text: "hi" }];
const callParts = [{ functionCall: { name: "search", args: { q: "x" } } }];

describe("gemini finish reason metadata", () => {
  test.each([
    ["STOP", textParts, "stop"],
    ["MAX_TOKENS", textParts, "length"],
    ["SAFETY", textParts, "refusal"],
    ["MALFORMED_FUNCTION_CALL", textParts, "error"],
    ["MALFORMED_RESPONSE", textParts, "error"],
    ["SOMETHING_NEW", textParts, "other"],
    ["STOP", callParts, "tool_call"],
  ])("invoke maps %s", (finishReason, parts, normalized) => {
    const result = api.responseToChatResult(response(parts, finishReason));
    expect(result.generations[0].message.response_metadata).toMatchObject({
      finish_reason: finishReason,
      normalized_finish_reason: normalized,
    });
  });

  test("legacy stream sets finish metadata only on the finishing chunk", () => {
    const first = api.responseToChatGeneration(response(textParts));
    const last = api.responseToChatGeneration(
      response(textParts, "MAX_TOKENS")
    );
    expect(first?.message.response_metadata).toEqual({
      model_provider: "google-vertexai",
    });
    expect(last?.message.response_metadata).toEqual({
      model_provider: "google-vertexai",
      finish_reason: "MAX_TOKENS",
      normalized_finish_reason: "length",
    });
  });

  test("legacy stream maps STOP with a function call to tool_call", () => {
    const chunk = api.responseToChatGeneration(response(callParts, "STOP"));
    expect(chunk?.message.response_metadata).toMatchObject({
      finish_reason: "STOP",
      normalized_finish_reason: "tool_call",
    });
  });
});
