import type { ContentBlock } from "../content/index.js";

export function _isContentBlock<T extends string>(
  block: unknown,
  type: T
): block is ContentBlock & { type: T } {
  return _isObject(block) && block.type === type;
}

export function _isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function _isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function _isString(value: unknown): value is string {
  return typeof value === "string";
}

export function _isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function _isBytesArray(value: unknown): value is Uint8Array {
  // oxlint-disable-next-line no-instanceof/no-instanceof
  return value instanceof Uint8Array;
}

export function safeParseJson<T = unknown>(value: string): T | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export const iife = <T>(fn: () => T): T => fn();

// The REST API and the older `@google/generative-ai` SDK spell this differently.
const GEMINI_UNSPECIFIED_BLOCK_REASONS = new Set([
  "BLOCK_REASON_UNSPECIFIED",
  "BLOCKED_REASON_UNSPECIFIED",
]);

const GEMINI_REFUSAL_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
]);

/**
 * Builds a refusal block from a Gemini finish reason or prompt block reason.
 *
 * Gemini reports a blocked reply as a finish reason on the candidate, and a
 * blocked prompt as a block reason in the prompt feedback.
 */
export function _geminiRefusalFromMetadata(
  metadata: Record<string, unknown> | undefined
): ContentBlock.Refusal | undefined {
  if (!_isObject(metadata)) return undefined;
  const extras: Record<string, unknown> = {};
  const finishReason = metadata.finishReason ?? metadata.finish_reason;
  if (
    _isString(finishReason) &&
    GEMINI_REFUSAL_FINISH_REASONS.has(finishReason)
  ) {
    extras.finishReason = finishReason;
  }
  const feedback = metadata.promptFeedback ?? metadata.prompt_feedback;
  const blockReason = _isObject(feedback)
    ? (feedback.blockReason ?? feedback.block_reason)
    : undefined;
  if (
    _isString(blockReason) &&
    !GEMINI_UNSPECIFIED_BLOCK_REASONS.has(blockReason)
  ) {
    extras.blockReason = blockReason;
  }
  if (Object.keys(extras).length === 0) return undefined;
  const finishMessage = metadata.finishMessage ?? metadata.finish_message;
  return {
    type: "refusal",
    refusal: _isString(finishMessage) ? finishMessage : "",
    extras,
  };
}
