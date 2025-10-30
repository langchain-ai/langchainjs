/**
 * Tool call limit middleware for agents.
 */

import { AIMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import type { InferInteropZodInput } from "@langchain/core/utils/types";

import { createMiddleware } from "../middleware.js";

/**
 * Build a message indicating which tool call limits were reached.
 *
 * @param threadCount - Current thread tool call count.
 * @param runCount - Current run tool call count.
 * @param threadLimit - Thread tool call limit (if set).
 * @param runLimit - Run tool call limit (if set).
 * @param toolName - Tool name being limited (if specific tool), or undefined for all tools.
 * @returns A formatted message describing which limits were reached.
 */
function buildToolLimitExceededMessage(
  threadCount: number,
  runCount: number,
  threadLimit: number | undefined,
  runLimit: number | undefined,
  toolName: string | undefined
): string {
  const toolDesc = toolName ? `'${toolName}' tool call` : "Tool call";
  const exceededLimits: string[] = [];

  if (threadLimit !== undefined && threadCount >= threadLimit) {
    exceededLimits.push(`thread limit reached (${threadCount}/${threadLimit})`);
  }
  if (runLimit !== undefined && runCount >= runLimit) {
    exceededLimits.push(`run limit reached (${runCount}/${runLimit})`);
  }

  return `${toolDesc} limit${
    exceededLimits.length > 1 ? "s" : ""
  }: ${exceededLimits.join(", ")}. Stopping to prevent further tool calls.`;
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
   * - "end": Jump to the end of the agent execution and inject an artificial
   *   AI message indicating that the limit was exceeded.
   * - "error": throws a ToolCallLimitExceededError
   */
  exitBehavior: z.enum(["end", "error"]).default("end"),
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
 *   - "end": Jump to the end of the agent execution and inject an artificial AI message indicating that the limit was exceeded.
 *   - "error": throws a ToolCallLimitExceededError
 *
 * @throws {Error} If both limits are undefined or if exitBehavior is invalid.
 *
 * @example Limit all tool calls globally
 * ```ts
 * import { toolCallLimitMiddleware } from "@langchain/langchain/agents/middleware";
 * import { createAgent } from "@langchain/langchain/agents";
 *
 * const globalLimiter = toolCallLimitMiddleware({
 *   threadLimit: 20,
 *   runLimit: 10,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [globalLimiter]
 * });
 * ```
 *
 * @example Limit a specific tool
 * ```ts
 * import { toolCallLimitMiddleware } from "@langchain/langchain/agents/middleware";
 * import { createAgent } from "@langchain/langchain/agents";
 *
 * const searchLimiter = toolCallLimitMiddleware({
 *   toolName: "search",
 *   threadLimit: 5,
 *   runLimit: 3,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [searchLimiter]
 * });
 * ```
 *
 * @example Use both in the same agent
 * ```ts
 * import { toolCallLimitMiddleware } from "@langchain/langchain/agents/middleware";
 * import { createAgent } from "@langchain/langchain/agents";
 *
 * const globalLimiter = toolCallLimitMiddleware({
 *   threadLimit: 20,
 *   runLimit: 10,
 *   exitBehavior: "end"
 * });
 *
 * const searchLimiter = toolCallLimitMiddleware({
 *   toolName: "search",
 *   threadLimit: 5,
 *   runLimit: 3,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [globalLimiter, searchLimiter]
 * });
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
   * Apply default for exitBehavior and validate
   */
  const exitBehavior = options.exitBehavior ?? "end";
  if (exitBehavior !== "end" && exitBehavior !== "error") {
    throw new Error(
      `Invalid exit behavior: ${exitBehavior}. Must be 'end' or 'error'`
    );
  }

  /**
   * Generate the middleware name based on the tool name
   */
  const middlewareName = options.toolName
    ? `ToolCallLimitMiddleware[${options.toolName}]`
    : "ToolCallLimitMiddleware";

  return createMiddleware({
    name: middlewareName,
    stateSchema,
    beforeModel: {
      canJumpTo: ["end"],
      hook: (state) => {
        /**
         * Count tool calls in entire thread
         */
        const threadCount =
          state.threadToolCallCount?.[
            options.toolName ?? DEFAULT_TOOL_COUNT_KEY
          ] ?? 0;

        /**
         * Count tool calls in current run (after last HumanMessage)
         */
        const runCount =
          state.runToolCallCount?.[
            options.toolName ?? DEFAULT_TOOL_COUNT_KEY
          ] ?? 0;

        /**
         * Check if any limits are exceeded
         */
        const threadLimitExceeded =
          options.threadLimit !== undefined &&
          threadCount >= options.threadLimit;
        const runLimitExceeded =
          options.runLimit !== undefined && runCount >= options.runLimit;

        if (!threadLimitExceeded && !runLimitExceeded) {
          return undefined;
        }

        if (exitBehavior === "error") {
          throw new ToolCallLimitExceededError(
            threadCount,
            runCount,
            options.threadLimit,
            options.runLimit,
            options.toolName
          );
        }

        /**
         * Create a message indicating the limit was exceeded
         */
        const limitMessage = buildToolLimitExceededMessage(
          threadCount,
          runCount,
          options.threadLimit,
          options.runLimit,
          options.toolName
        );
        const limitAiMessage = new AIMessage(limitMessage);

        return {
          jumpTo: "end",
          messages: [limitAiMessage],
        };
      },
    },
    afterModel: (state) => {
      const lastAIMessage = [...state.messages]
        .reverse()
        .find(AIMessage.isInstance);
      if (!lastAIMessage || !lastAIMessage.tool_calls) {
        return state;
      }

      const toolCallCount = lastAIMessage.tool_calls.filter(
        (toolCall) =>
          options.toolName === undefined || toolCall.name === options.toolName
      ).length;
      if (toolCallCount === 0) {
        return state;
      }

      const countKey = options.toolName ?? DEFAULT_TOOL_COUNT_KEY;
      const threadCounts = state.threadToolCallCount;
      const runCounts = state.runToolCallCount;

      threadCounts[countKey] = (threadCounts[countKey] ?? 0) + toolCallCount;
      runCounts[countKey] = (runCounts[countKey] ?? 0) + toolCallCount;

      return {
        threadToolCallCount: threadCounts,
        runToolCallCount: runCounts,
      };
    },
  });
}
