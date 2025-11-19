/**
 * Model retry middleware for agents.
 */
import { z } from "zod/v3";
import { AIMessage } from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";
import type { AgentMiddleware } from "./types.js";

/**
 * Configuration options for the Model Retry Middleware.
 */
export const ModelRetryMiddlewareOptionsSchema = z.object({
  /**
   * Maximum number of retry attempts after the initial call.
   * Default is 2 retries (3 total attempts). Must be >= 0.
   */
  maxRetries: z.number().min(0).default(2),

  /**
   * Either an array of error constructors to retry on, or a function
   * that takes an error and returns `true` if it should be retried.
   * Default is to retry on all errors.
   */
  retryOn: z
    .union([
      z.function().args(z.instanceof(Error)).returns(z.boolean()),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      z.array(z.custom<new (...args: any[]) => Error>()),
    ])
    .default(() => () => true),

  /**
   * Behavior when all retries are exhausted. Options:
   * - `"raise"` (default): Re-raise the exception, stopping agent execution.
   * - `"return_message"`: Return an AIMessage with error details, allowing
   *   the agent to potentially handle the failure gracefully.
   * - Custom function: Function that takes the exception and returns a string
   *   for the AIMessage content, allowing custom error formatting.
   */
  onFailure: z
    .union([
      z.literal("raise"),
      z.literal("return_message"),
      z.function().args(z.instanceof(Error)).returns(z.string()),
    ])
    .default("raise"),

  /**
   * Multiplier for exponential backoff. Each retry waits
   * `initialDelayMs * (backoffFactor ** retryNumber)` milliseconds.
   * Set to 0.0 for constant delay. Default is 2.0.
   */
  backoffFactor: z.number().min(0).default(2.0),

  /**
   * Initial delay in milliseconds before first retry. Default is 1000 (1 second).
   */
  initialDelayMs: z.number().min(0).default(1000),

  /**
   * Maximum delay in milliseconds between retries. Caps exponential
   * backoff growth. Default is 60000 (60 seconds).
   */
  maxDelayMs: z.number().min(0).default(60000),

  /**
   * Whether to add random jitter (±25%) to delay to avoid thundering herd.
   * Default is `true`.
   */
  jitter: z.boolean().default(true),
});

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
 *   onFailure: "return_message", // Return AIMessage with error instead of throwing
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
 * @example Raise exception on failure (default)
 * ```ts
 * const retry = modelRetryMiddleware({
 *   maxRetries: 2,
 *   onFailure: "raise", // Re-raise exception (default behavior)
 * });
 * ```
 *
 * @param config - Configuration options for the retry middleware
 * @returns A middleware instance that handles model failures with retries
 */
export function modelRetryMiddleware(
  config: ModelRetryMiddlewareConfig = {}
): AgentMiddleware {
  const {
    maxRetries,
    retryOn,
    onFailure,
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter,
  } = ModelRetryMiddlewareOptionsSchema.parse(config);

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
  const handleFailure = (error: Error): AIMessage => {
    if (onFailure === "raise") {
      throw error;
    }

    let content: string;
    if (typeof onFailure === "function") {
      content = onFailure(error);
    } else {
      // We don't know the exact attempt count when using RunnableRetry,
      // but we can estimate it based on maxRetries
      const attemptsMade = maxRetries + 1;
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
      // Build retry options for withRetry
      const retryOptions = {
        stopAfterAttempt: maxRetries + 1, // maxRetries is retries after initial, so total attempts is maxRetries + 1
        retryOn,
        backoffFactor,
        initialDelayMs,
        maxDelayMs,
        jitter,
      };

      try {
        // Invoke the retry runnable with the request
        return await handler({
          ...request,
          model: request.model.withRetry(retryOptions),
        });
      } catch (error) {
        // RunnableRetry throws on failure, but we need to handle onFailure option
        const err =
          error && typeof error === "object" && "message" in error
            ? (error as Error)
            : new Error(String(error));

        return handleFailure(err);
      }
    },
  });
}
