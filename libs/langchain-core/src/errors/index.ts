/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AIMessageChunk } from "../messages/ai.js";
import { ns as baseNs } from "../utils/namespace.js";

export type LangChainErrorCodes =
  | "CONTEXT_OVERFLOW"
  | "INVALID_PROMPT_INPUT"
  | "INVALID_TOOL_RESULTS"
  | "MESSAGE_COERCION_FAILURE"
  | "MODEL_AUTHENTICATION"
  | "MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMIT"
  | "OUTPUT_PARSING_FAILURE"
  | "MODEL_ABORTED";

/** @deprecated Subclass LangChainError instead */
export function addLangChainErrorFields(
  error: any,
  lc_error_code: LangChainErrorCodes
) {
  (error as any).lc_error_code = lc_error_code;
  error.message = `${error.message}\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/${lc_error_code}/\n`;
  return error;
}

/** The error namespace for all LangChain errors */
export const ns = baseNs.sub("error");

/**
 * Base error class for all LangChain errors.
 *
 * All LangChain error classes should extend this class (directly or
 * indirectly). Use `LangChainError.isInstance(obj)` to check if an
 * object is any LangChain error.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (error) {
 *   if (LangChainError.isInstance(error)) {
 *     console.log("Got a LangChain error:", error.message);
 *   }
 * }
 * ```
 */
export class LangChainError extends ns.brand(Error) {
  readonly name: string = "LangChainError";

  constructor(message?: string) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error class representing an aborted model operation in LangChain.
 *
 * This error is thrown when a model operation (such as invocation, streaming, or batching)
 * is cancelled before it completes, commonly due to a user-initiated abort signal
 * (e.g., via an AbortController) or an upstream cancellation event.
 *
 * The ModelAbortError provides access to any partial output the model may have produced
 * before the operation was interrupted, which can be useful for resuming work, debugging,
 * or presenting incomplete results to users.
 *
 * @remarks
 * - The `partialOutput` field includes message content that was generated prior to the abort,
 *   such as a partial AIMessageChunk.
 * - This error extends the {@link LangChainError} base class with the marker `"model-abort"`.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke(input, { signal: abortController.signal });
 * } catch (err) {
 *   if (ModelAbortError.isInstance(err)) {
 *     // Handle user cancellation, check err.partialOutput if needed
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 */
export class ModelAbortError extends ns.brand(LangChainError, "model-abort") {
  readonly name = "ModelAbortError";

  /**
   * The partial message output that was produced before the operation was aborted.
   * This is typically an AIMessageChunk, or could be undefined if no output was available.
   */
  readonly partialOutput?: AIMessageChunk;

  /**
   * Constructs a new ModelAbortError instance.
   *
   * @param message - A human-readable message describing the abort event.
   * @param partialOutput - Any partial model output generated before the abort (optional).
   */
  constructor(message: string, partialOutput?: AIMessageChunk) {
    super(message);
    this.partialOutput = partialOutput;
  }
}

/**
 * Error class representing a context window overflow in a language model operation.
 *
 * This error is thrown when the combined input to a language model (such as prompt tokens,
 * historical messages, and/or instructions) exceeds the maximum context window or token limit
 * that the model can process in a single request. Most models have defined upper limits for the number of
 * tokens or characters allowed in a context, and exceeding this limit will prevent
 * the operation from proceeding.
 *
 * The {@link ContextOverflowError} extends the {@link LangChainError} base class with
 * the marker `"context-overflow"`.
 *
 * @remarks
 * - Use this error to programmatically identify cases where a user request, prompt, or input
 *   sequence is too long to be handled by the target model.
 * - Model providers and framework integrations should throw this error if they detect
 *   a request cannot be processed due to its size.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke(veryLongInput);
 * } catch (err) {
 *   if (ContextOverflowError.isInstance(err)) {
 *     // Handle overflow, e.g., prompt user to shorten input or truncate text
 *     console.warn("Model context overflow:", err.message);
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 */
export class ContextOverflowError extends ns.brand(
  LangChainError,
  "context-overflow"
) {
  readonly name = "ContextOverflowError";

  constructor(message?: string) {
    super(message ?? "Input exceeded the model's context window.");
  }
}

/**
 * Error thrown when input exceeds the model's context limit.
 *
 * This exception is raised by chat models when the input tokens exceed
 * the maximum context window supported by the model.
 */
export class ContextOverflowError extends Error {
  readonly name = "ContextOverflowError";

  readonly lc_error_code = "CONTEXT_OVERFLOW";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextOverflowError);
    }
  }

  /**
   * Type guard to check if an error is a ContextOverflowError
   */
  static isInstance(error: unknown): error is ContextOverflowError {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ContextOverflowError" &&
      "lc_error_code" in error &&
      error.lc_error_code === "CONTEXT_OVERFLOW"
    );
  }
}
