/**
 * Tool retry middleware for agents.
 */

import { ToolMessage } from "@langchain/core/messages";

import type { AgentMiddleware } from "./types.js";
import { createMiddleware } from "../middleware.js";
import type { ClientTool, ServerTool } from "../tools.js";

/**
 * Custom error class for value validation errors.
 */
class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

/**
 * Configuration options for the Tool Retry Middleware.
 */
export interface ToolRetryMiddlewareConfig {
  /**
   * Maximum number of retry attempts after the initial call.
   * Default is 2 retries (3 total attempts). Must be >= 0.
   */
  maxRetries?: number;

  /**
   * Optional list of tools or tool names to apply retry logic to.
   * Can be a list of `BaseTool` instances or tool name strings.
   * If `undefined`, applies to all tools. Default is `undefined`.
   */
  tools?: (ClientTool | ServerTool | string)[];

  /**
   * Either an array of error constructors to retry on, or a function
   * that takes an error and returns `true` if it should be retried.
   * Default is to retry on all errors.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retryOn?: ((error: Error) => boolean) | (new (...args: any[]) => Error)[];

  /**
   * Behavior when all retries are exhausted. Options:
   * - `"return_message"` (default): Return a ToolMessage with error details,
   *   allowing the LLM to handle the failure and potentially recover.
   * - `"raise"`: Re-raise the exception, stopping agent execution.
   * - Custom function: Function that takes the exception and returns a string
   *   for the ToolMessage content, allowing custom error formatting.
   */
  onFailure?: "raise" | "return_message" | ((error: Error) => string);

  /**
   * Multiplier for exponential backoff. Each retry waits
   * `initialDelay * (backoffFactor ** retryNumber)` milliseconds.
   * Set to 0.0 for constant delay. Default is 2.0.
   */
  backoffFactor?: number;

  /**
   * Initial delay in milliseconds before first retry. Default is 1000 (1 second).
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries. Caps exponential
   * backoff growth. Default is 60000 (60 seconds).
   */
  maxDelay?: number;

  /**
   * Whether to add random jitter (±25%) to delay to avoid thundering herd.
   * Default is `true`.
   */
  jitter?: boolean;
}

/**
 * Middleware that automatically retries failed tool calls with configurable backoff.
 *
 * Supports retrying on specific exceptions and exponential backoff.
 *
 * @example Basic usage with default settings (2 retries, exponential backoff)
 * ```ts
 * import { createAgent, toolRetryMiddleware } from "langchain";
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [searchTool],
 *   middleware: [toolRetryMiddleware()],
 * });
 * ```
 *
 * @example Retry specific exceptions only
 * ```ts
 * import { toolRetryMiddleware } from "langchain";
 *
 * const retry = toolRetryMiddleware({
 *   maxRetries: 4,
 *   retryOn: [TimeoutError, NetworkError],
 *   backoffFactor: 1.5,
 * });
 * ```
 *
 * @example Custom exception filtering
 * ```ts
 * function shouldRetry(error: Error): boolean {
 *   // Only retry on 5xx errors
 *   if (error.name === "HTTPError" && "statusCode" in error) {
 *     const statusCode = (error as any).statusCode;
 *     return 500 <= statusCode && statusCode < 600;
 *   }
 *   return false;
 * }
 *
 * const retry = toolRetryMiddleware({
 *   maxRetries: 3,
 *   retryOn: shouldRetry,
 * });
 * ```
 *
 * @example Apply to specific tools with custom error handling
 * ```ts
 * const formatError = (error: Error) =>
 *   "Database temporarily unavailable. Please try again later.";
 *
 * const retry = toolRetryMiddleware({
 *   maxRetries: 4,
 *   tools: ["search_database"],
 *   onFailure: formatError,
 * });
 * ```
 *
 * @example Apply to specific tools using BaseTool instances
 * ```ts
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const searchDatabase = tool(
 *   async ({ query }) => {
 *     // Search implementation
 *     return results;
 *   },
 *   {
 *     name: "search_database",
 *     description: "Search the database",
 *     schema: z.object({ query: z.string() }),
 *   }
 * );
 *
 * const retry = toolRetryMiddleware({
 *   maxRetries: 4,
 *   tools: [searchDatabase], // Pass BaseTool instance
 * });
 * ```
 *
 * @example Constant backoff (no exponential growth)
 * ```ts
 * const retry = toolRetryMiddleware({
 *   maxRetries: 5,
 *   backoffFactor: 0.0, // No exponential growth
 *   initialDelay: 2000, // Always wait 2 seconds
 * });
 * ```
 *
 * @example Raise exception on failure
 * ```ts
 * const retry = toolRetryMiddleware({
 *   maxRetries: 2,
 *   onFailure: "raise", // Re-raise exception instead of returning message
 * });
 * ```
 *
 * @param config - Configuration options for the retry middleware
 * @returns A middleware instance that handles tool failures with retries
 */
export function toolRetryMiddleware(
  config: ToolRetryMiddlewareConfig = {}
): AgentMiddleware {
  const {
    maxRetries = 2,
    tools,
    retryOn = () => true, // Default: retry all errors
    onFailure = "return_message",
    backoffFactor = 2.0,
    initialDelay = 1000, // 1 second in milliseconds
    maxDelay = 60000, // 60 seconds in milliseconds
    jitter = true,
  } = config;

  // Validate parameters
  if (maxRetries < 0) {
    throw new ValueError("maxRetries must be >= 0");
  }
  if (initialDelay < 0) {
    throw new ValueError("initialDelay must be >= 0");
  }
  if (maxDelay < 0) {
    throw new ValueError("maxDelay must be >= 0");
  }
  if (backoffFactor < 0) {
    throw new ValueError("backoffFactor must be >= 0");
  }

  // Extract tool names from BaseTool instances or strings
  const toolFilter: string[] | undefined = tools?.map((tool) =>
    typeof tool === "string" ? tool : (tool.name as string)
  );

  /**
   * Check if retry logic should apply to this tool.
   */
  const shouldRetryTool = (toolName: string): boolean => {
    if (toolFilter === undefined) {
      return true;
    }
    return toolFilter.includes(toolName);
  };

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

  /**
   * Calculate delay for the given retry attempt.
   */
  const calculateDelay = (retryNumber: number): number => {
    let delay: number;
    if (backoffFactor === 0.0) {
      delay = initialDelay;
    } else {
      delay = initialDelay * backoffFactor ** retryNumber;
    }

    // Cap at maxDelay
    delay = Math.min(delay, maxDelay);

    if (jitter && delay > 0) {
      const jitterAmount = delay * 0.25;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
      // Ensure delay is not negative after jitter
      delay = Math.max(0, delay);
    }

    return delay;
  };

  /**
   * Format the failure message when retries are exhausted.
   */
  const formatFailureMessage = (
    toolName: string,
    error: Error,
    attemptsMade: number
  ): string => {
    const errorType = error.constructor.name;
    const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
    return `Tool '${toolName}' failed after ${attemptsMade} ${attemptWord} with ${errorType}`;
  };

  /**
   * Handle failure when all retries are exhausted.
   */
  const handleFailure = (
    toolName: string,
    toolCallId: string,
    error: Error,
    attemptsMade: number
  ): ToolMessage => {
    if (onFailure === "raise") {
      throw error;
    }

    let content: string;
    if (typeof onFailure === "function") {
      content = onFailure(error);
    } else {
      content = formatFailureMessage(toolName, error, attemptsMade);
    }

    return new ToolMessage({
      content,
      tool_call_id: toolCallId,
      name: toolName,
      status: "error",
    });
  };

  /**
   * Sleep for the specified number of milliseconds.
   */
  const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  return createMiddleware({
    name: "toolRetryMiddleware",
    wrapToolCall: async (request, handler) => {
      const toolName = request.tool.name as string;

      // Check if retry should apply to this tool
      if (!shouldRetryTool(toolName)) {
        return handler(request);
      }

      const toolCallId = request.toolCall.id ?? "";

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
            return handleFailure(toolName, toolCallId, err, attemptsMade);
          }

          // Check if we have more retries left
          if (attempt < maxRetries) {
            // Calculate and apply backoff delay
            const delay = calculateDelay(attempt);
            if (delay > 0) {
              await sleep(delay);
            }
            // Continue to next retry
          } else {
            // No more retries, handle failure
            return handleFailure(toolName, toolCallId, err, attemptsMade);
          }
        }
      }

      // Unreachable: loop always returns via handler success or handleFailure
      throw new Error("Unexpected: retry loop completed without returning");
    },
  });
}
