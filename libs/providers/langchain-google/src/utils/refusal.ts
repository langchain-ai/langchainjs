import { ModelRefusalError } from "@langchain/core/errors";
import type { Gemini } from "../chat_models/types.js";
import { PromptBlockedError } from "./errors.js";

/** Builds the error for a blocked prompt, marked as a refusal when it is one. */
export function promptBlockedError(
  promptFeedback: Gemini.GenContent.GenerateContentResponse["promptFeedback"] &
    object
): PromptBlockedError {
  const error = PromptBlockedError.fromPromptFeedback(promptFeedback);
  if (promptFeedback.blockReason !== "BLOCK_REASON_UNSPECIFIED") {
    ModelRefusalError.markAsRefusal(error);
  }
  return error;
}
