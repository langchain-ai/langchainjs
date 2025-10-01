import { z } from "zod/v3";
import { AIMessage } from "@langchain/core/messages";
import { InferInteropZodInput } from "@langchain/core/utils/types";

import { createMiddleware } from "../middleware.js";

const DEFAULT_EXIT_BEHAVIOR = "end";

const contextSchema = z.object({
  /**
   * The maximum number of model calls allowed per thread.
   */
  threadLimit: z.number().optional(),
  /**
   * The maximum number of model calls allowed per run.
   */
  runLimit: z.number().optional(),
  /**
   * The behavior to take when the limit is exceeded.
   * - "throw" will throw an error and stop the agent.
   * - "end" will end the agent.
   * @default "end"
   */
  exitBehavior: z.enum(["throw", "end"]).optional(),
});
export type ModelCallLimitMiddlewareConfig = Partial<
  InferInteropZodInput<typeof contextSchema>
>;

class ModelCallLimitMiddlewareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelCallLimitMiddlewareError";
  }
}

/**
 * Creates a middleware to limit the number of model calls at both thread and run levels.
 *
 * This middleware helps prevent excessive model API calls by enforcing limits on how many
 * times the model can be invoked. It supports two types of limits:
 *
 * - **Thread-level limit**: Restricts the total number of model calls across an entire conversation thread
 * - **Run-level limit**: Restricts the number of model calls within a single agent run/invocation
 *
 * ## How It Works
 *
 * The middleware intercepts model requests before they are sent and checks the current call counts
 * against the configured limits. If either limit is exceeded, it throws a `ModelCallLimitMiddlewareError`
 * to stop execution and prevent further API calls.
 *
 * ## Use Cases
 *
 * - **Cost Control**: Prevent runaway costs from excessive model calls in production
 * - **Testing**: Ensure agents don't make too many calls during development/testing
 * - **Safety**: Limit potential infinite loops or recursive agent behaviors
 * - **Rate Limiting**: Enforce organizational policies on model usage per conversation
 *
 * @param middlewareOptions - Configuration options for the call limits
 * @param middlewareOptions.threadLimit - Maximum number of model calls allowed per thread (optional)
 * @param middlewareOptions.runLimit - Maximum number of model calls allowed per run (optional)
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @throws {ModelCallLimitMiddlewareError} When either the thread or run limit is exceeded
 *
 * @example
 * ```typescript
 * import { createAgent, modelCallLimitMiddleware } from "langchain";
 *
 * // Limit to 10 calls per thread and 3 calls per run
 * const agent = createAgent({
 *   model: "openai:gpt-4o-mini",
 *   tools: [myTool],
 *   middleware: [
 *     modelCallLimitMiddleware({
 *       threadLimit: 10,
 *       runLimit: 3
 *     })
 *   ]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Limits can also be configured at runtime via context
 * const result = await agent.invoke(
 *   { messages: ["Hello"] },
 *   {
 *     configurable: {
 *       threadLimit: 5  // Override the default limit for this run
 *     }
 *   }
 * );
 * ```
 */
export function modelCllLimitMiddleware(
  middlewareOptions?: ModelCallLimitMiddlewareConfig
) {
  return createMiddleware({
    name: "ModelCallLimitMiddleware",
    contextSchema,
    beforeModelJumpTo: ["end"],
    beforeModel: (state, runtime) => {
      const exitBehavior =
        runtime.context.exitBehavior ??
        middlewareOptions?.exitBehavior ??
        DEFAULT_EXIT_BEHAVIOR;
      const threadLimit =
        runtime.context.threadLimit ?? middlewareOptions?.threadLimit;
      const runLimit = runtime.context.runLimit ?? middlewareOptions?.runLimit;

      if (threadLimit && threadLimit < runtime.threadLevelCallCount) {
        const errorMessage = `Thread level call limit reached with ${runtime.threadLevelCallCount} model calls (allowed: ${threadLimit})`;
        if (exitBehavior === "end") {
          return {
            jumpTo: "end",
            messages: [new AIMessage(errorMessage)],
          };
        }

        throw new ModelCallLimitMiddlewareError(errorMessage);
      }
      if (runLimit && runLimit < runtime.runModelCallCount) {
        const errorMessage = `Run level call limit reached with ${runtime.runModelCallCount} model calls (allowed: ${runLimit})`;
        if (exitBehavior === "end") {
          return {
            jumpTo: "end",
            messages: [new AIMessage(errorMessage)],
          };
        }

        throw new ModelCallLimitMiddlewareError(errorMessage);
      }

      return state;
    },
  });
}
