import type {
  FinishReason,
  MessageFinishEvent,
} from "@langchain/core/language_models/event";

/**
 * Maps an Ollama `done_reason` onto the stream event finish fields.
 * Returns nothing when the provider sent no done reason.
 */
export function mapOllamaDoneReason(
  reason: string | undefined,
  sawToolCall: boolean
): Pick<
  MessageFinishEvent,
  "finishReason" | "normalizedFinishReason" | "reason"
> {
  if (!reason) return {};
  let normalizedFinishReason: FinishReason;
  switch (reason) {
    case "stop":
      normalizedFinishReason = sawToolCall ? "tool_call" : "stop";
      break;
    case "length":
      normalizedFinishReason = "length";
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
 * `response_metadata` finish keys that core reads on invoke and legacy streams.
 */
export function getFinishReasonMetadata(
  reason: string | undefined,
  sawToolCall: boolean
): { finish_reason?: string; normalized_finish_reason?: FinishReason } {
  const { finishReason, normalizedFinishReason } = mapOllamaDoneReason(
    reason,
    sawToolCall
  );
  if (!finishReason) return {};
  return {
    finish_reason: finishReason,
    normalized_finish_reason: normalizedFinishReason,
  };
}

// Keeps the deprecated `reason` populated with its old values.
function toLegacyReason(reason: FinishReason): MessageFinishEvent["reason"] {
  if (reason === "tool_call") return "tool_use";
  if (reason === "refusal") return "content_filter";
  if (reason === "context_exceeded") return "length";
  return reason === "other" || reason === "error" ? undefined : reason;
}
