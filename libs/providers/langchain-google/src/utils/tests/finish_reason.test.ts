import { describe, expect, test } from "vitest";
import type { Gemini } from "../../chat_models/types.js";
import { convertInteractionToAIMessage } from "../../converters/interactions/messages.js";
import {
  mapGeminiFinishReason,
  mapInteractionStatus,
  toFinishReasonMetadata,
} from "../finish_reason.js";

describe("mapGeminiFinishReason", () => {
  test.each([
    ["STOP", false, "stop", "stop"],
    ["STOP", true, "tool_call", "tool_use"],
    ["MAX_TOKENS", false, "length", "length"],
    ["SAFETY", false, "refusal", "content_filter"],
    ["PROHIBITED_CONTENT", false, "refusal", "content_filter"],
    ["BLOCKLIST", false, "refusal", "content_filter"],
    ["RECITATION", false, "content_filter", "content_filter"],
    ["IMAGE_SAFETY", false, "content_filter", "content_filter"],
    ["MALFORMED_FUNCTION_CALL", false, "error", undefined],
    ["malformed_response", false, "error", undefined],
    ["SOMETHING_NEW", false, "other", undefined],
  ])("maps %s (tool call: %s)", (raw, sawToolCall, normalized, legacy) => {
    expect(mapGeminiFinishReason(raw, sawToolCall)).toEqual({
      finishReason: raw,
      normalizedFinishReason: normalized,
      reason: legacy,
    });
  });

  test("returns nothing without a finish reason", () => {
    expect(mapGeminiFinishReason(undefined, true)).toEqual({});
    expect(
      toFinishReasonMetadata(mapGeminiFinishReason(undefined, true))
    ).toEqual({});
  });

  test("converts to response_metadata keys", () => {
    expect(
      toFinishReasonMetadata(mapGeminiFinishReason("STOP", false))
    ).toEqual({ finish_reason: "STOP", normalized_finish_reason: "stop" });
  });
});

describe("mapInteractionStatus", () => {
  test.each([
    ["completed", false, "stop"],
    ["completed", true, "tool_call"],
    ["requires_action", false, "tool_call"],
    ["failed", false, "error"],
    ["cancelled", false, "other"],
  ])("maps %s (tool call: %s)", (status, sawToolCall, normalized) => {
    expect(mapInteractionStatus(status, sawToolCall)).toMatchObject({
      finishReason: status,
      normalizedFinishReason: normalized,
    });
  });
});

describe("convertInteractionToAIMessage finish metadata", () => {
  test("sets finish reason metadata for a completed interaction", () => {
    const { message } = convertInteractionToAIMessage({
      id: "int-1",
      status: "completed",
      outputs: [{ type: "text", text: "hi" }],
    } as unknown as Gemini.Interactions.Interaction);
    expect(message.response_metadata).toMatchObject({
      finishReason: "STOP",
      finish_reason: "completed",
      normalized_finish_reason: "stop",
    });
  });

  test("maps a completed interaction with a function call to tool_call", () => {
    const { message } = convertInteractionToAIMessage({
      id: "int-2",
      status: "completed",
      outputs: [
        { type: "function_call", id: "fc-1", name: "search", arguments: {} },
      ],
    } as unknown as Gemini.Interactions.Interaction);
    expect(message.response_metadata).toMatchObject({
      finish_reason: "completed",
      normalized_finish_reason: "tool_call",
    });
  });
});
