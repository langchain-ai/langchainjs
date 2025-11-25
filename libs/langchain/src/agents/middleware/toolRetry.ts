/**
 * Tool retry middleware for agents.
 */
import { z } from "zod/v3";
import { ToolMessage } from "@langchain/core/messages";
import type { ClientTool, ServerTool } from "@langchain/core/tools";

import { createMiddleware } from "../middleware.js";
import type { AgentMiddleware } from "./types.js";
import { sleep, calculateRetryDelay } from "./utils.js";
import { RetrySchema } from "./constants.js";
import { InvalidRetryConfigError } from "./error.js";

/**
 * Configuration options for the Tool Retry Middleware.
 */
export const ToolRetryMiddlewareOptionsSchema = z
  .object({
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
     * Behavior when all retries are exhausted. Options:
     * - `"continue"` (default): Return an AIMessage with error details, allowing
     *   the agent to potentially handle the failure gracefully.
     * - `"error"`: Re-raise the exception, stopping agent execution.
     * - Custom function: Function that takes the exception and returns a string
     *   for the AIMessage content, allowing custom error formatting.
     *
     * Deprecated values:
     * - `"raise"`: use `"error"` instead.
     * - `"return_message"`: use `"continue"` instead.
     */
    onFailure: z
      .union([
        z.literal("error"),
        z.literal("continue"),
        /**
         * @deprecated Use `"error"` instead.
         */
        z.literal("raise"),
        /**
         * @deprecated Use `"continue"` instead.
         */
        z.literal("return_message"),
        z.function().args(z.instanceof(Error)).returns(z.string()),
      ])
      .default("continue"),
  })
  .merge(RetrySchema);

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
  const { success, error, data } =
    ToolRetryMiddlewareOptionsSchema.safeParse(config);
  if (!success) {
    throw new InvalidRetryConfigError(error);
  }
  const {
    maxRetries,
    tools,
    retryOn,
    onFailure: onFailureConfig,
    backoffFactor,
    initialDelayMs,
    maxDelayMs,
    jitter,
  } = data;

  let onFailure = onFailureConfig;
  if (onFailureConfig === "raise") {
    console.warn(
      "⚠️ `onFailure: 'raise'` is deprecated. Use `onFailure: 'error'` instead."
    );
    onFailure = "error";
  } else if (onFailureConfig === "return_message") {
    console.warn(
      "⚠️ `onFailure: 'return_message'` is deprecated. Use `onFailure: 'continue'` instead."
    );
    onFailure = "continue";
  }

  // Extract tool names from BaseTool instances or strings
  const toolFilter: string[] = [];
  for (const tool of tools ?? []) {
    if (typeof tool === "string") {
      toolFilter.push(tool);
    } else if ("name" in tool && typeof tool.name === "string") {
      toolFilter.push(tool.name);
    } else {
      throw new TypeError(
        "Expected a tool name string or tool instance to be passed to toolRetryMiddleware"
      );
    }
  }

  /**
   * Check if retry logic should apply to this tool.
   */
  const shouldRetryTool = (toolName: string): boolean => {
    if (toolFilter.length === 0) {
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
    return retryOn.some((ErrorConstructor) => {
      // eslint-disable-next-line no-instanceof/no-instanceof
      return error instanceof ErrorConstructor;
    });
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
    if (onFailure === "error") {
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
      const toolName = (request.tool?.name ?? request.toolCall.name) as string;

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
