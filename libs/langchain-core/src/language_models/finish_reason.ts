import type { FinishReason, FinishState, MessageFinishEvent } from "./event.js";

/** @internal */
export interface NormalizedFinish {
  normalizedFinishReason?: FinishReason;
  finishState?: FinishState;
}

const GENERIC_FINISH_REASONS: Record<string, FinishReason> = {
  // OpenAI chat completions and OpenAI-compatible APIs
  stop: "stop",
  length: "length",
  max_tokens: "length",
  tool_calls: "tool_call",
  function_call: "tool_call",
  content_filter: "content_filter",
  // Anthropic
  end_turn: "stop",
  stop_sequence: "stop",
  tool_use: "tool_call",
  refusal: "content_filter",
  model_context_window_exceeded: "length",
  // Gemini
  max_token: "length",
  safety: "content_filter",
  recitation: "content_filter",
  language: "content_filter",
  blocklist: "content_filter",
  prohibited_content: "content_filter",
  spii: "content_filter",
  image_safety: "content_filter",
  image_prohibited_content: "content_filter",
  image_recitation: "content_filter",
  // Bedrock Converse
  guardrail_intervened: "content_filter",
  content_filtered: "content_filter",
  // Ollama
  load: "stop",
};

const SUSPENDED_FINISH_REASONS = new Set(["pause_turn"]);

/**
 * Best-effort mapping of a raw provider finish reason, for code paths that
 * don't know which provider produced it (the legacy chunk bridge).
 * Unknown values map to `"other"`, never `"stop"`.
 * @internal
 */
export function normalizeFinishReason(
  raw: string | null | undefined,
  options?: { hasToolCalls?: boolean }
): NormalizedFinish {
  if (raw == null || raw === "") return {};
  const key = raw.toLowerCase().replace(/-/g, "_");
  if (SUSPENDED_FINISH_REASONS.has(key)) {
    return { normalizedFinishReason: "other", finishState: "suspended" };
  }
  const mapped = GENERIC_FINISH_REASONS[key] ?? "other";
  // Gemini reports STOP even when the response contains function calls.
  if (mapped === "stop" && options?.hasToolCalls) {
    return { normalizedFinishReason: "tool_call", finishState: "complete" };
  }
  return { normalizedFinishReason: mapped, finishState: "complete" };
}

/**
 * Keeps the deprecated `reason` populated with its old values.
 * @internal
 */
export function toLegacyFinishReason(
  reason: FinishReason | undefined
): MessageFinishEvent["reason"] {
  if (reason === "tool_call") return "tool_use";
  return reason === "other" || reason === "error" ? undefined : reason;
}
