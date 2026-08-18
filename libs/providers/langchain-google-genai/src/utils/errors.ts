import {
  ns as baseNs,
  LangChainError,
  stampRetryable,
} from "@langchain/core/errors";
import type { FinishReason } from "@google/generative-ai";

const ns = baseNs.sub("google-genai");

export interface EmptyContentErrorParams {
  /**
   * The candidate's `finishReason`, when available (e.g. `"SAFETY"`,
   * `"RECITATION"`, `"MALFORMED_FUNCTION_CALL"`, `"MAX_TOKENS"`, `"OTHER"`).
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
 * This covers two distinct situations that both surface the same way —
 * a candidate with no `content` at all:
 * - An explicit block from Google (a safety/recitation/prohibited-content
 *   filter, or a rejected prompt via `blockReason`).
 * - The model just not producing usable output for other reasons, e.g. a
 *   thinking model exhausting its token budget on reasoning (`MAX_TOKENS`)
 *   or an invalid tool call (`MALFORMED_FUNCTION_CALL`) — nothing was
 *   "blocked" in either case, the model simply returned nothing.
 *
 * Previously this was silently converted into an empty message; it's now
 * surfaced as a typed, catchable error. Check `finishReason`/`blockReason`
 * to distinguish an explicit block from the model just being odd.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("...");
 * } catch (error) {
 *   if (EmptyContentError.isInstance(error)) {
 *     console.log(`No content: ${error.finishReason ?? error.blockReason}`);
 *   }
 * }
 * ```
 */
export class EmptyContentError extends ns.brand(
  LangChainError,
  "empty-content"
) {
  readonly name = "EmptyContentError";

  readonly finishReason?: FinishReason | string;

  readonly blockReason?: string;

  constructor(params: EmptyContentErrorParams = {}) {
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
