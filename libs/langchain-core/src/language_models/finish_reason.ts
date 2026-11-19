import type { FinishReason, FinishState, MessageFinishEvent } from "./event.js";
import type { AIMessage } from "../messages/ai.js";
import type { BaseMessage } from "../messages/base.js";

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
  refusal: "refusal",
  model_context_window_exceeded: "context_exceeded",
  // Gemini
  max_token: "length",
  safety: "refusal",
  recitation: "content_filter",
  language: "content_filter",
  blocklist: "refusal",
  prohibited_content: "refusal",
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
  options?: { hasToolCalls?: boolean; hasRefusal?: boolean }
): NormalizedFinish {
  if (raw == null || raw === "") return {};
  const key = raw.toLowerCase().replace(/-/g, "_");
  if (SUSPENDED_FINISH_REASONS.has(key)) {
    return { normalizedFinishReason: "other", finishState: "suspended" };
  }
  // OpenAI refuses with a normal `stop`; the refusal block is the signal.
  if (options?.hasRefusal) {
    return { normalizedFinishReason: "refusal" };
  }
  const mapped = GENERIC_FINISH_REASONS[key] ?? "other";
  // Gemini reports STOP even when the response contains function calls.
  if (mapped === "stop" && options?.hasToolCalls) {
    return { normalizedFinishReason: "tool_call" };
  }
  return { normalizedFinishReason: mapped };
}

/**
 * Keeps the deprecated `reason` populated with its old values.
 * @internal
 */
export function toLegacyFinishReason(
  reason: FinishReason | undefined
): MessageFinishEvent["reason"] {
  if (reason === "tool_call") return "tool_use";
  if (reason === "refusal") return "content_filter";
  if (reason === "context_exceeded") return "length";
  return reason === "other" || reason === "error" ? undefined : reason;
}

const RESPONSES_INCOMPLETE: Record<string, FinishReason> = {
  max_output_tokens: "length",
  content_filter: "content_filter",
};

function normalizeResponsesStatus(
  status: string,
  incompleteDetails: unknown,
  hasToolCalls: boolean
): FinishReason {
  if (status === "completed") return hasToolCalls ? "tool_call" : "stop";
  if (status === "failed") return "error";
  if (status === "incomplete") {
    const reason =
      typeof incompleteDetails === "object" && incompleteDetails !== null
        ? (incompleteDetails as { reason?: unknown }).reason
        : undefined;
    return typeof reason === "string"
      ? (RESPONSES_INCOMPLETE[reason] ?? "other")
      : "other";
  }
  return "other";
}

function readFinishValue(
  metadata: Record<string, unknown>
): string | undefined {
  for (const key of ["finish_reason", "stop_reason", "finishReason"]) {
    const value = metadata[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

/**
 * Adds `finish_reason`, `normalized_finish_reason` and (Anthropic only)
 * `finish_state` to a non-streamed AI message's `response_metadata`.
 * Existing values are kept.
 * @internal
 */
export function addFinishReasonFields(message: BaseMessage): void {
  if (message.type !== "ai") return;
  const metadata = (message.response_metadata ?? {}) as Record<string, unknown>;
  const hasToolCalls = ((message as AIMessage).tool_calls?.length ?? 0) > 0;
  const hasRefusal = message.contentBlocks.some(
    (block) => block.type === "refusal"
  );
  const status = metadata.status;
  let raw = readFinishValue(metadata);
  let finish: NormalizedFinish;
  if (
    raw === undefined &&
    metadata.model_provider === "openai" &&
    typeof status === "string"
  ) {
    // OpenAI Responses reports `status` instead of a finish reason.
    raw = status;
    finish = {
      normalizedFinishReason: hasRefusal
        ? "refusal"
        : normalizeResponsesStatus(
            status,
            metadata.incomplete_details,
            hasToolCalls
          ),
    };
  } else {
    finish = normalizeFinishReason(raw, { hasToolCalls, hasRefusal });
  }
  if (raw === undefined) return;
  // Only Anthropic can suspend a turn, so only it reports a finish state.
  const finishState =
    finish.finishState ??
    (metadata.model_provider === "anthropic" ? "complete" : undefined);
  message.response_metadata = {
    finish_reason: raw,
    normalized_finish_reason: finish.normalizedFinishReason,
    ...(finishState ? { finish_state: finishState } : {}),
    ...metadata,
  };
}
