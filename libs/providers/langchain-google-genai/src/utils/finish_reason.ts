import type {
  FinishReason,
  MessageFinishEvent,
} from "@langchain/core/language_models/event";

type FinishFields = Pick<
  MessageFinishEvent,
  "finishReason" | "normalizedFinishReason" | "reason"
>;

/**
 * Maps a Gemini finish reason onto the standard
 * finish fields. Matching is case-insensitive.
 */
export function mapGeminiFinishReason(
  reason: string | undefined,
  sawToolCall: boolean
): FinishFields {
  if (!reason) return {};
  let normalizedFinishReason: FinishReason;
  switch (reason.toLowerCase().replace(/-/g, "_")) {
    case "stop":
      normalizedFinishReason = sawToolCall ? "tool_call" : "stop";
      break;
    case "max_tokens":
    case "max_token":
      normalizedFinishReason = "length";
      break;
    case "safety":
    case "blocklist":
    case "prohibited_content":
      normalizedFinishReason = "refusal";
      break;
    case "recitation":
    case "language":
    case "spii":
    case "image_safety":
    case "image_prohibited_content":
    case "image_recitation":
      normalizedFinishReason = "content_filter";
      break;
    case "malformed_function_call":
    case "malformed_response":
      normalizedFinishReason = "error";
      break;
    default:
      normalizedFinishReason = "other";
  }
  return {
    finishReason: reason,
    normalizedFinishReason,
    reason: toLegacyReason(normalizedFinishReason),
  };
}

/**
 * Converts finish fields to the `response_metadata` keys core reads.
 */
export function toFinishReasonMetadata(fields: FinishFields): {
  finish_reason?: string;
  normalized_finish_reason?: FinishReason;
} {
  return {
    ...(fields.finishReason ? { finish_reason: fields.finishReason } : {}),
    ...(fields.normalizedFinishReason
      ? { normalized_finish_reason: fields.normalizedFinishReason }
      : {}),
  };
}

// Keeps the deprecated `reason` populated with its old values.
function toLegacyReason(reason: FinishReason): MessageFinishEvent["reason"] {
  if (reason === "tool_call") return "tool_use";
  if (reason === "refusal") return "content_filter";
  if (reason === "context_exceeded") return "length";
  return reason === "other" || reason === "error" ? undefined : reason;
}
