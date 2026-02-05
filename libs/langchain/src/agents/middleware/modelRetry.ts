/**
 * Model retry middleware for agents.
 */
import { z } from "zod/v3";
import { AIMessage } from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";
import type { AgentMiddleware } from "./types.js";
import { sleep, calculateRetryDelay } from "./utils.js";
import { RetrySchema } from "./constants.js";
import { InvalidRetryConfigError } from "./error.js";

/**
 * Configuration options for the Model Retry Middleware.
 */
export const ModelRetryMiddlewareOptionsSchema = z
  .object({
    /**
     * Behavior when all retries are exhausted. Options:
     * - `"continue"` (default): Return an AIMessage with error details, allowing
     *   the agent to potentially handle the failure gracefully.
     * - `"error"`: Re-raise the exception, stopping agent execution.
     * - Custom function: Function that takes the exception and returns a string
     *   for the AIMessage content, allowing custom error formatting.
     */
    onFailure: z
      .union([
        z.literal("error"),
        z.literal("continue"),
        z.function().args(z.instanceof(Error)).returns(z.string()),
      ])
      .default("continue"),
  })
  .merge(RetrySchema);

export type ModelRetryMiddlewareConfig = z.input<
  typeof ModelRetryMiddlewareOptionsSchema
>;

/**
 * Middleware that automatically retries failed model calls with configurable backoff.
 *
 * Supports retrying on specific exceptions and exponential backoff.
 *
 * @example Basic usage with default settings (2 retries, exponential backoff)
 * ```ts
 * import { createAgent, modelRetryMiddleware } from "langchain";
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [searchTool],
 *   middleware: [modelRetryMiddleware()],
 * });
 * ```
 *
 * @example Retry specific exceptions only
 * ```ts
 * import { modelRetryMiddleware } from "langchain";
 *
 * const retry = modelRetryMiddleware({
 *   maxRetries: 4,
 *   retryOn: [TimeoutError, NetworkError],
 *   backoffFactor: 1.5,
 * });
 * ```
 *
 * @example Custom exception filtering
 * ```ts
 * function shouldRetry(error: Error): boolean {
 *   // Only retry on rate limit errors
 *   if (error.name === "RateLimitError") {
 *     return true;
 *   }
 *   // Or check for specific HTTP status codes
 *   if (error.name === "HTTPError" && "statusCode" in error) {
 *     const statusCode = (error as any).statusCode;
 *     return statusCode === 429 || statusCode === 503;
 *   }
 *   return false;
 * }
 *
 * const retry = modelRetryMiddleware({
 *   maxRetries: 3,
 *   retryOn: shouldRetry,
 * });
 * ```
 *
 * @example Return error message instead of raising
 * ```ts
 * const retry = modelRetryMiddleware({
 *   maxRetries: 4,
 *   onFailure: "continue", // Return AIMessage with error instead of throwing
 * });
 * ```
 *
 * @example Custom error message formatting
 * ```ts
 * const formatError = (error: Error) =>
 *   `Model call failed: ${error.message}. Please try again later.`;
 *
 * const retry = modelRetryMiddleware({
 *   maxRetries: 4,
 *   onFailure: formatError,
 * });
 * ```
 *
 * @example Constant backoff (no exponential growth)
 * ```ts
 * const retry = modelRetryMiddleware({
 *   maxRetries: 5,
 *   backoffFactor: 0.0, // No exponential growth
 *   initialDelayMs: 2000, // Always wait 2 seconds
 * });
 * ```
 *
 * @example Raise exception on failure
 * ```ts
 * const retry = modelRetryMiddleware({
 *   maxRetries: 2,
 *   onFailure: "error", // Re-raise exception instead of returning message
 * });
 * ```
 *
 * @param config - Configuration options for the retry middleware
 * @returns A middleware instance that handles model failures with retries
 */
export function modelRetryMiddleware(
  config: ModelRetryMiddlewareConfig = {}
): AgentMiddleware {
  const { success, error, data } =
    ModelRetryMiddlewareOptionsSchema.safeParse(config);
  if (!success) {
    throw new InvalidRetryConfigError(error);
  }
  const {
    maxRetries,
    retryOn,
    onFailure,
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter,
  } = data;

  /**
   * Check if the exception should trigger a retry.
   */
  const shouldRetryException = (error: Error): boolean => {
    if (typeof retryOn === "function") {
      return retryOn(error);
    }
    // retryOn is an array of error constructors
    return retryOn.some(
      (ErrorConstructor) => error.constructor === ErrorConstructor
    );
  };

  // Use the exported calculateRetryDelay function with our config
  const delayConfig = { backoffFactor, initialDelayMs, maxDelayMs, jitter };

  /**
   * Format the failure message when retries are exhausted.
   */
  const formatFailureMessage = (error: Error, attemptsMade: number): string => {
    const errorType = error.constructor.name;
    const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
    return `Model call failed after ${attemptsMade} ${attemptWord} with ${errorType}: ${error.message}`;
  };

  /**
   * Handle failure when all retries are exhausted.
   */
  const handleFailure = (error: Error, attemptsMade: number): AIMessage => {
    if (onFailure === "error") {
      throw error;
    }

    let content: string;
    if (typeof onFailure === "function") {
      content = onFailure(error);
    } else {
      content = formatFailureMessage(error, attemptsMade);
    }

    return new AIMessage({
      content,
    });
  };

  return createMiddleware({
    name: "modelRetryMiddleware",
    contextSchema: ModelRetryMiddlewareOptionsSchema,
    wrapModelCall: async (request, handler) => {
      // Initial attempt + retries
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await handler(request);
        } catch (error) {
          const attemptsMade = attempt + 1; // attempt is 0-indexed

          // Ensure error is an Error instance
          const err =
            error && typeof error === "object" && "message" in error
              ? (error as Error)
              : new Error(String(error));

          // Check if we should retry this exception
          if (!shouldRetryException(err)) {
            // Exception is not retryable, handle failure immediately
            return handleFailure(err, attemptsMade);
          }

          // Check if we have more retries left
          if (attempt < maxRetries) {
            // Calculate and apply backoff delay
            const delay = calculateRetryDelay(delayConfig, attempt);
            if (delay > 0) {
              await sleep(delay);
            }
            // Continue to next retry
          } else {
            // No more retries, handle failure
            return handleFailure(err, attemptsMade);
          }
        }
      }

      // Unreachable: loop always returns via handler success or handleFailure
      throw new Error("Unexpected: retry loop completed without returning");
    },
  });
}
