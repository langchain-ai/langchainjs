import {
  ns as baseNs,
  LangChainError,
  stampRetryable,
} from "@langchain/core/errors";
import type { FinishReason } from "@google/generative-ai";

const ns = baseNs.sub("google-genai");

export interface ContentBlockedErrorParams {
  /**
   * The candidate's `finishReason`, when available (e.g. `"SAFETY"`,
   * `"RECITATION"`, `"MALFORMED_FUNCTION_CALL"`, `"OTHER"`).
   */
  finishReason?: FinishReason | string;
  /**
   * The prompt-level `blockReason`, when the request was rejected before
   * any candidate was generated at all.
   */
  blockReason?: string;
  /**
   * Optional custom error message. If not provided, a default message is
   * generated from `finishReason`/`blockReason`.
   */
  message?: string;
}

/**
 * Error thrown when a Gemini candidate is returned with no usable content.
 *
 * Gemini signals that generation was cut short (a safety/recitation filter,
 * a malformed function call, etc.) by returning a candidate whose `content`
 * is missing entirely, rather than an error response. Previously this was
 * silently converted into an empty message; it's now surfaced as a typed,
 * catchable error so callers can distinguish "the model said nothing" from
 * "the model was blocked."
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("...");
 * } catch (error) {
 *   if (ContentBlockedError.isInstance(error)) {
 *     console.log(`Blocked: ${error.finishReason}`);
 *   }
 * }
 * ```
 */
export class ContentBlockedError extends ns.brand(
  LangChainError,
  "content-blocked"
) {
  readonly name = "ContentBlockedError";

  readonly finishReason?: FinishReason | string;

  readonly blockReason?: string;

  constructor(params: ContentBlockedErrorParams = {}) {
    const message =
      params.message ??
      `The model returned no content.${
        params.blockReason ? ` Block reason: ${params.blockReason}.` : ""
      }${params.finishReason ? ` Finish reason: ${params.finishReason}.` : ""}`;
    super(message);
    this.finishReason = params.finishReason;
    this.blockReason = params.blockReason;
    // Retrying the same input against the same filter/finish reason won't help.
    stampRetryable(this, false);
  }
}
