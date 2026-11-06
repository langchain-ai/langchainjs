import { ModelRefusalError } from "@langchain/core/errors";
import type { Gemini } from "../chat_models/types.js";
import { PromptBlockedError } from "./errors.js";

// The Gemini API and Vertex AI spell the unspecified reason differently.
const UNSPECIFIED_BLOCK_REASONS = new Set<string>([
  "BLOCK_REASON_UNSPECIFIED",
  "BLOCKED_REASON_UNSPECIFIED",
]);

/** Builds the error for a blocked prompt, marked as a refusal when it is one. */
export function promptBlockedError(
  promptFeedback: Gemini.GenContent.GenerateContentResponse["promptFeedback"] &
    object
): PromptBlockedError {
  const error = PromptBlockedError.fromPromptFeedback(promptFeedback);
  if (!UNSPECIFIED_BLOCK_REASONS.has(String(promptFeedback.blockReason))) {
    ModelRefusalError.markAsRefusal(error);
  }
  return error;
}
