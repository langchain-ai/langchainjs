import type { Gemini } from "../chat_models/types.js";
import { PromptBlockedError, PromptRefusedError } from "./errors.js";

// The Gemini API and Vertex AI spell the unspecified reason differently.
const UNSPECIFIED_BLOCK_REASONS = new Set<string>([
  "BLOCK_REASON_UNSPECIFIED",
  "BLOCKED_REASON_UNSPECIFIED",
]);

/** Builds the error for a blocked prompt, a refusal unless the reason is unspecified. */
export function promptBlockedError(
  promptFeedback: Gemini.GenContent.GenerateContentResponse["promptFeedback"] &
    object
): PromptBlockedError {
  const ErrorClass = UNSPECIFIED_BLOCK_REASONS.has(
    promptFeedback.blockReason ?? ""
  )
    ? PromptBlockedError
    : PromptRefusedError;
  return ErrorClass.fromPromptFeedback(promptFeedback);
}
