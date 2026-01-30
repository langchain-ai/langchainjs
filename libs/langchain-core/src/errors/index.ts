/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AIMessageChunk } from "../messages/ai.js";

export type LangChainErrorCodes =
  | "INVALID_PROMPT_INPUT"
  | "INVALID_TOOL_RESULTS"
  | "MESSAGE_COERCION_FAILURE"
  | "MODEL_AUTHENTICATION"
  | "MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMIT"
  | "OUTPUT_PARSING_FAILURE"
  | "MODEL_ABORTED";

export function addLangChainErrorFields(
  error: any,
  lc_error_code: LangChainErrorCodes
) {
  (error as any).lc_error_code = lc_error_code;
  error.message = `${error.message}\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/${lc_error_code}/\n`;
  return error;
}

/**
 * Error thrown when a model invocation is aborted via an AbortSignal.
 * Contains any partial output that was generated before the abort.
 */
export class ModelAbortError extends Error {
  readonly name = "ModelAbortError";

  readonly lc_error_code = "MODEL_ABORTED";

  /**
   * The partial message output that was accumulated before the abort.
   * This allows callers to access whatever content was generated
   * before the operation was cancelled.
   */
  readonly partialOutput?: AIMessageChunk;

  constructor(message: string, partialOutput?: AIMessageChunk) {
    super(message);
    this.partialOutput = partialOutput;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModelAbortError);
    }
  }

  /**
   * Type guard to check if an error is a ModelAbortError
   */
  static isInstance(error: unknown): error is ModelAbortError {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ModelAbortError" &&
      "lc_error_code" in error &&
      error.lc_error_code === "MODEL_ABORTED"
    );
  }
}
