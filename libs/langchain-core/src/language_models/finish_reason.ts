import type { FinishReason, FinishState, MessageFinishEvent } from "./event.js";
import type { AIMessage } from "../messages/ai.js";
import type { BaseMessage } from "../messages/base.js";

/**
 * Finish fields that provider integrations set on `response_metadata`.
 * Core never maps provider values itself; it only reads these keys.
 * @internal
 */
export interface FinishFields {
  finishReason?: string;
  normalizedFinishReason?: FinishReason;
  finishState?: FinishState;
}

function readString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Reads the finish fields a provider set on `response_metadata`.
 * @internal
 */
export function readFinishFields(
  metadata: Record<string, unknown> | undefined
): FinishFields {
  const finishReason = readString(metadata, "finish_reason");
  const normalizedFinishReason = readString(
    metadata,
    "normalized_finish_reason"
  ) as FinishReason | undefined;
  const finishState = readString(metadata, "finish_state") as
    | FinishState
    | undefined;
  return {
    ...(finishReason ? { finishReason } : {}),
    ...(normalizedFinishReason ? { normalizedFinishReason } : {}),
    ...(finishState ? { finishState } : {}),
  };
}

/**
 * Provider-agnostic corrections on a normalized finish reason. Refusals and
 * tool calls can arrive in earlier stream chunks than the finish reason.
 * @internal
 */
export function correctFinishReason(
  normalized: FinishReason | undefined,
  options: { hasToolCalls?: boolean; hasRefusal?: boolean }
): FinishReason | undefined {
  if (normalized === undefined) return undefined;
  if (options.hasRefusal) return "refusal";
  if (normalized === "stop" && options.hasToolCalls) return "tool_call";
  return normalized;
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

/**
 * Applies the generic corrections to a final message's
 * `normalized_finish_reason`. Does nothing unless the provider set it.
 * @internal
 */
export function correctFinishFields(message: BaseMessage): void {
  if (message.type !== "ai") return;
  const metadata = (message.response_metadata ?? {}) as Record<string, unknown>;
  const { normalizedFinishReason } = readFinishFields(metadata);
  if (normalizedFinishReason === undefined) return;
  const corrected = correctFinishReason(normalizedFinishReason, {
    hasToolCalls: ((message as AIMessage).tool_calls?.length ?? 0) > 0,
    hasRefusal: message.contentBlocks.some((block) => block.type === "refusal"),
  });
  if (corrected === normalizedFinishReason) return;
  message.response_metadata = {
    ...metadata,
    normalized_finish_reason: corrected,
  };
}
