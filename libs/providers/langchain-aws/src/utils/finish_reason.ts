import type {
  FinishReason,
  MessageFinishEvent,
} from "@langchain/core/language_models/event";

/**
 * Maps a Converse `stopReason` onto the stream event finish fields.
 * Returns nothing when the provider sent no stop reason.
 */
export function mapStopReason(
  reason: string | undefined
): Pick<
  MessageFinishEvent,
  "finishReason" | "normalizedFinishReason" | "reason"
> {
  if (!reason) return {};
  let normalizedFinishReason: FinishReason;
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      normalizedFinishReason = "stop";
      break;
    case "tool_use":
      normalizedFinishReason = "tool_call";
      break;
    case "max_tokens":
      normalizedFinishReason = "length";
      break;
    case "model_context_window_exceeded":
      normalizedFinishReason = "context_exceeded";
      break;
    case "guardrail_intervened":
    case "content_filtered":
      normalizedFinishReason = "content_filter";
      break;
    case "malformed_model_output":
    case "malformed_tool_use":
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
 * `response_metadata` finish keys that core reads on invoke and legacy streams.
 */
export function getFinishReasonMetadata(reason: string | undefined): {
  finish_reason?: string;
  normalized_finish_reason?: FinishReason;
} {
  const { finishReason, normalizedFinishReason } = mapStopReason(reason);
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
