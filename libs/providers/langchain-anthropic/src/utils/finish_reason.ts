// Local copies of core's types so older `@langchain/core` peers still work.
export type AnthropicNormalizedFinishReason =
  | "stop"
  | "length"
  | "tool_call"
  | "content_filter"
  | "refusal"
  | "context_exceeded"
  | "error"
  | "other";

export type AnthropicFinishState = "complete" | "suspended";

const STOP_REASON_MAP: Record<string, AnthropicNormalizedFinishReason> = {
  end_turn: "stop",
  stop_sequence: "stop",
  max_tokens: "length",
  tool_use: "tool_call",
  refusal: "refusal",
  model_context_window_exceeded: "context_exceeded",
  pause_turn: "other",
};

export interface AnthropicFinishReasonInfo {
  finishReason: string;
  normalizedFinishReason: AnthropicNormalizedFinishReason;
  finishState: AnthropicFinishState;
}

/** Maps an Anthropic `stop_reason`; returns undefined when it is missing. */
export function mapAnthropicStopReason(
  stopReason: string | null | undefined
): AnthropicFinishReasonInfo | undefined {
  if (stopReason == null) return undefined;
  return {
    finishReason: stopReason,
    normalizedFinishReason: Object.hasOwn(STOP_REASON_MAP, stopReason)
      ? STOP_REASON_MAP[stopReason]
      : "other",
    finishState: stopReason === "pause_turn" ? "suspended" : "complete",
  };
}

/** The snake_case `response_metadata` keys core reads finish reasons from. */
export function finishReasonResponseMetadata(
  stopReason: string | null | undefined
): Record<string, string> {
  const info = mapAnthropicStopReason(stopReason);
  if (!info) return {};
  return {
    finish_reason: info.finishReason,
    normalized_finish_reason: info.normalizedFinishReason,
    finish_state: info.finishState,
  };
}
