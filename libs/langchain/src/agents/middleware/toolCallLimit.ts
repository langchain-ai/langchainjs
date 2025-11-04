import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import type { InferInteropZodInput } from "@langchain/core/utils/types";

import { createMiddleware } from "../middleware.js";

/**
 * Build a message indicating which tool call limits were exceeded.
 *
 * @param threadCount - Current thread tool call count.
 * @param runCount - Current run tool call count.
 * @param threadLimit - Thread tool call limit (if set).
 * @param runLimit - Run tool call limit (if set).
 * @param toolName - Tool name being limited (if specific tool), or undefined for all tools.
 * @returns A formatted message describing which limits were exceeded.
 */
function buildToolLimitExceededMessage(
  threadCount: number,
  runCount: number,
  threadLimit: number | undefined,
  runLimit: number | undefined,
  toolName: string | undefined
): string {
  const toolDesc = toolName ? `'${toolName}' tool` : "Tool";
  const exceededLimits: string[] = [];

  if (threadLimit !== undefined && threadCount > threadLimit) {
    exceededLimits.push(
      `thread limit exceeded (${threadCount}/${threadLimit} calls)`
    );
  }
  if (runLimit !== undefined && runCount > runLimit) {
    exceededLimits.push(`run limit exceeded (${runCount}/${runLimit} calls)`);
  }

  const limitsText = exceededLimits.join(" and ");

  // Build a concise message
  if (toolName) {
    return `${toolDesc} call limit reached: ${limitsText}. Do not call '${toolName}' again.`;
  }
  return `${toolDesc} call limit reached: ${limitsText}. Do not make additional tool calls.`;
}

/**
 * Exception raised when tool call limits are exceeded.
 *
 * This exception is raised when the configured exit behavior is 'error'
 * and either the thread or run tool call limit has been exceeded.
 */
export class ToolCallLimitExceededError extends Error {
  /**
   * Current thread tool call count.
   */
  threadCount: number;
  /**
   * Current run tool call count.
   */
  runCount: number;
  /**
   * Thread tool call limit (if set).
   */
  threadLimit: number | undefined;
  /**
   * Run tool call limit (if set).
   */
  runLimit: number | undefined;
  /**
   * Tool name being limited (if specific tool), or undefined for all tools.
   */
  toolName: string | undefined;

  constructor(
    threadCount: number,
    runCount: number,
    threadLimit: number | undefined,
    runLimit: number | undefined,
    toolName: string | undefined = undefined
  ) {
    const message = buildToolLimitExceededMessage(
      threadCount,
      runCount,
      threadLimit,
      runLimit,
      toolName
    );
    super(message);

    this.name = "ToolCallLimitExceededError";
    this.threadCount = threadCount;
    this.runCount = runCount;
    this.threadLimit = threadLimit;
    this.runLimit = runLimit;
    this.toolName = toolName;
  }
}

/**
 * Options for configuring the Tool Call Limit middleware.
 */
export const ToolCallLimitOptionsSchema = z.object({
  /**
   * Name of the specific tool to limit. If undefined, limits apply to all tools.
   */
  toolName: z.string().optional(),
  /**
   * Maximum number of tool calls allowed per thread.
   * undefined means no limit.
   */
  threadLimit: z.number().optional(),
  /**
   * Maximum number of tool calls allowed per run.
   * undefined means no limit.
   */
  runLimit: z.number().optional(),
  /**
   * What to do when limits are exceeded.
   * - "continue": Block exceeded tools with error messages, let other tools continue (default)
   * - "error": Raise a ToolCallLimitExceededError exception
   * - "end": Stop execution immediately, injecting a ToolMessage and an AI message
   *   for the single tool call that exceeded the limit. Raises NotImplementedError
   *   if there are multiple tool calls.
   */
  exitBehavior: z.enum(["continue", "error", "end"]).default("continue"),
});

export type ToolCallLimitConfig = InferInteropZodInput<
  typeof ToolCallLimitOptionsSchema
>;

/**
 * Middleware state schema to track the number of model calls made at the thread and run level.
 */
const stateSchema = z.object({
  threadToolCallCount: z.record(z.string(), z.number()).default({}),
  runToolCallCount: z.record(z.string(), z.number()).default({}),
});

const DEFAULT_TOOL_COUNT_KEY = "__all__";

/**
 * Middleware that tracks tool call counts and enforces limits.
 *
 * This middleware monitors the number of tool calls made during agent execution
 * and can terminate the agent when specified limits are reached. It supports
 * both thread-level and run-level call counting with configurable exit behaviors.
 *
 * Thread-level: The middleware counts all tool calls in the entire message history
 * and persists this count across multiple runs (invocations) of the agent.
 *
 * Run-level: The middleware counts tool calls made after the last HumanMessage,
 * representing the current run (invocation) of the agent.
 *
 * @param options - Configuration options for the middleware
 * @param options.toolName - Name of the specific tool to limit. If undefined, limits apply to all tools.
 * @param options.threadLimit - Maximum number of tool calls allowed per thread. undefined means no limit.
 * @param options.runLimit - Maximum number of tool calls allowed per run. undefined means no limit.
 * @param options.exitBehavior - What to do when limits are exceeded.
 *   - "continue": Block exceeded tools with error messages, let other tools continue. Model decides when to end. (default)
 *   - "error": Raise a ToolCallLimitExceededError exception
 *   - "end": Stop execution immediately with a ToolMessage + AI message for the single tool call that exceeded the limit. Raises NotImplementedError if there are multiple tool calls.
 *
 * @throws {Error} If both limits are undefined.
 * @throws {NotImplementedError} If exitBehavior is "end" and there are multiple tool calls.
 *
 * @example Continue execution with blocked tools (default)
 * ```ts
 * import { toolCallLimitMiddleware } from "@langchain/langchain/agents/middleware";
 * import { createAgent } from "@langchain/langchain/agents";
 *
 * // Block exceeded tools but let other tools and model continue
 * const limiter = toolCallLimitMiddleware({
 *   threadLimit: 20,
 *   runLimit: 10,
 *   exitBehavior: "continue", // default
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [limiter]
 * });
 * ```
 *
 * @example Stop immediately when limit exceeded
 * ```ts
 * // End execution immediately with an AI message
 * const limiter = toolCallLimitMiddleware({
 *   runLimit: 5,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [limiter]
 * });
 * ```
 *
 * @example Raise exception on limit
 * ```ts
 * // Strict limit with exception handling
 * const limiter = toolCallLimitMiddleware({
 *   toolName: "search",
 *   threadLimit: 5,
 *   exitBehavior: "error"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [limiter]
 * });
 *
 * try {
 *   const result = await agent.invoke({ messages: [new HumanMessage("Task")] });
 * } catch (error) {
 *   if (error instanceof ToolCallLimitExceededError) {
 *     console.log(`Search limit exceeded: ${error}`);
 *   }
 * }
 * ```
 */
export function toolCallLimitMiddleware(options: ToolCallLimitConfig) {
  /**
   * Validate that at least one limit is specified
   */
  if (options.threadLimit === undefined && options.runLimit === undefined) {
    throw new Error(
      "At least one limit must be specified (threadLimit or runLimit)"
    );
  }

  /**
   * Apply default for exitBehavior
   */
  const exitBehavior = options.exitBehavior ?? "continue";

  /**
   * Generate the middleware name based on the tool name
   */
  const middlewareName = options.toolName
    ? `ToolCallLimitMiddleware[${options.toolName}]`
    : "ToolCallLimitMiddleware";

  return createMiddleware({
    name: middlewareName,
    stateSchema,
    afterModel: {
      canJumpTo: ["end"],
      hook: (state) => {
        /**
         * Get the last AI message to check for tool calls
         */
        const lastAIMessage = [...state.messages]
          .reverse()
          .find(AIMessage.isInstance);

        if (!lastAIMessage || !lastAIMessage.tool_calls) {
          return undefined;
        }

        /**
         * Count tool calls matching our filter (all tools or specific tool)
         */
        const toolCallCount = lastAIMessage.tool_calls.filter(
          (toolCall) =>
            options.toolName === undefined || toolCall.name === options.toolName
        ).length;

        if (toolCallCount === 0) {
          return undefined;
        }

        /**
         * Get or initialize counts
         */
        const countKey = options.toolName ?? DEFAULT_TOOL_COUNT_KEY;
        const threadCounts = { ...(state.threadToolCallCount ?? {}) };
        const runCounts = { ...(state.runToolCallCount ?? {}) };

        /**
         * Increment counts for this key
         */
        const newThreadCount = (threadCounts[countKey] ?? 0) + toolCallCount;
        const newRunCount = (runCounts[countKey] ?? 0) + toolCallCount;

        threadCounts[countKey] = newThreadCount;
        runCounts[countKey] = newRunCount;

        /**
         * Check if any limits are exceeded after incrementing
         */
        const threadLimitExceeded =
          options.threadLimit !== undefined &&
          newThreadCount > options.threadLimit;
        const runLimitExceeded =
          options.runLimit !== undefined && newRunCount > options.runLimit;

        if (!threadLimitExceeded && !runLimitExceeded) {
          /**
           * No limits exceeded, just return updated counts
           */
          return {
            threadToolCallCount: threadCounts,
            runToolCallCount: runCounts,
          };
        }

        /**
         * Limits exceeded - build error message
         */
        const limitMessage = buildToolLimitExceededMessage(
          newThreadCount,
          newRunCount,
          options.threadLimit,
          options.runLimit,
          options.toolName
        );

        if (exitBehavior === "error") {
          throw new ToolCallLimitExceededError(
            newThreadCount,
            newRunCount,
            options.threadLimit,
            options.runLimit,
            options.toolName
          );
        }

        /**
         * For both "continue" and "end", inject artificial error ToolMessages
         * for tool calls that exceeded their limits
         */
        const artificialMessages: Array<ToolMessage | AIMessage> = [];
        for (const toolCall of lastAIMessage.tool_calls) {
          // Only inject errors for tool calls that match our filter
          if (
            options.toolName === undefined ||
            toolCall.name === options.toolName
          ) {
            artificialMessages.push(
              new ToolMessage({
                content: limitMessage,
                tool_call_id: toolCall.id!,
                name: toolCall.name,
                status: "error",
              })
            );
          }
        }

        if (exitBehavior === "end") {
          /**
           * For "end" behavior, only support single tool call scenarios
           */
          const toolsToBeCalled = new Set(
            lastAIMessage.tool_calls.map((toolCall) => toolCall.name)
          );
          if (toolsToBeCalled.size > 1) {
            throw new Error(
              `The 'end' exit behavior only supports a single tool type. Found ${
                toolsToBeCalled.size
              } different tools (${Array.from(toolsToBeCalled).join(
                ", "
              )}). Use 'continue' or 'error' behavior instead.`
            );
          }

          /**
           * Add final AI message explaining why we're stopping
           */
          artificialMessages.push(new AIMessage(limitMessage));

          return {
            threadToolCallCount: threadCounts,
            runToolCallCount: runCounts,
            jumpTo: "end" as const,
            messages: artificialMessages,
          };
        }

        /**
         * For exit_behavior="continue", just return the error messages
         * This prevents exceeded tools from being called but lets the model continue
         */
        return {
          threadToolCallCount: threadCounts,
          runToolCallCount: runCounts,
          messages: artificialMessages,
        };
      },
    },
  });
}
