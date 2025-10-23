/**
 * Tool retry middleware for agents.
 */

import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createMiddleware } from "../middleware.js";
import type { ClientTool, ServerTool } from "../tools.js";
import type { AgentMiddleware } from "./types.js";

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter.
 *
 * @param retryNumber - The retry attempt number (0-indexed)
 * @param config - Configuration for backoff calculation
 * @returns Delay in milliseconds before next retry
 *
 * @internal Exported for testing purposes
 */
export function calculateRetryDelay(
  config: {
    backoffFactor: number;
    initialDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
  },
  retryNumber: number
): number {
  const { backoffFactor, initialDelayMs, maxDelayMs, jitter } = config;

  let delay: number;
  if (backoffFactor === 0.0) {
    delay = initialDelayMs;
  } else {
    delay = initialDelayMs * backoffFactor ** retryNumber;
  }

  // Cap at maxDelayMs
  delay = Math.min(delay, maxDelayMs);

  if (jitter && delay > 0) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    // Ensure delay is not negative after jitter
    delay = Math.max(0, delay);
  }

  return delay;
}

/**
 * Configuration options for the Tool Retry Middleware.
 */
export const ToolRetryMiddlewareOptionsSchema = z.object({
  /**
   * Maximum number of retry attempts after the initial call.
   * Default is 2 retries (3 total attempts). Must be >= 0.
   */
  maxRetries: z.number().min(0).default(2),

  /**
   * Optional list of tools or tool names to apply retry logic to.
   * Can be a list of `BaseTool` instances or tool name strings.
   * If `undefined`, applies to all tools. Default is `undefined`.
   */
  tools: z
    .array(
      z.union([z.custom<ClientTool>(), z.custom<ServerTool>(), z.string()])
    )
    .optional(),

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
   * - `"return_message"` (default): Return a ToolMessage with error details,
   *   allowing the LLM to handle the failure and potentially recover.
   * - `"raise"`: Re-raise the exception, stopping agent execution.
   * - Custom function: Function that takes the exception and returns a string
   *   for the ToolMessage content, allowing custom error formatting.
   */
  onFailure: z
    .union([
      z.literal("raise"),
      z.literal("return_message"),
      z.function().args(z.instanceof(Error)).returns(z.string()),
    ])
    .default("return_message"),

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

export type ToolRetryMiddlewareConfig = z.input<
  typeof ToolRetryMiddlewareOptionsSchema
>;

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
 *   initialDelayMs: 2000, // Always wait 2 seconds
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
    maxRetries,
    tools,
    retryOn,
    onFailure,
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter,
  } = ToolRetryMiddlewareOptionsSchema.parse(config);

  // Extract tool names from BaseTool instances or strings
  const toolFilter = tools?.reduce((acc, tool) => {
    if (typeof tool === "string") return [...acc, tool];
    else if ("name" in tool && typeof tool.name === "string")
      return [...acc, tool.name];
    else return acc;
  }, [] as string[]);

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

  // Use the exported calculateRetryDelay function with our config
  const delayConfig = { backoffFactor, initialDelayMs, maxDelayMs, jitter };

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

  return createMiddleware({
    name: "toolRetryMiddleware",
    contextSchema: ToolRetryMiddlewareOptionsSchema,
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
            const delay = calculateRetryDelay(delayConfig, attempt);
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

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
