import { SystemMessage } from "@langchain/core/messages";
import { createMiddleware } from "../middleware.js";
import type { Runtime, AgentBuiltInState } from "../types.js";

/**
 * Dynamic System Prompt Middleware
 *
 * Allows setting the system prompt dynamically right before each model invocation.
 * Useful when the prompt depends on the current agent state or per-invocation context.
 *
 * @typeParam TContextSchema - The shape of the runtime context available at invocation time.
 * If your agent defines a `contextSchema`, pass the inferred type here to get full type-safety
 * for `runtime.context`.
 *
 * @param fn - Function that receives the current agent `state` and `runtime`, and
 * returns the system prompt for the next model call as a string.
 *
 * @returns A middleware instance that sets `systemMessage` for the next model call.
 *
 * @example Basic usage with typed context
 * ```ts
 * import { z } from "zod";
 * import { dynamicSystemPrompt } from "langchain/middleware";
 * import { createAgent, SystemMessage } from "langchain";
 *
 * const contextSchema = z.object({ region: z.string().optional() });
 *
 * const middleware = dynamicSystemPrompt<z.infer<typeof contextSchema>>(
 *   (_state, runtime) => `You are a helpful assistant. Region: ${runtime.context.region ?? "n/a"}`
 * );
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   contextSchema,
 *   middleware: [middleware],
 * });
 *
 * await agent.invoke({ messages }, { context: { region: "EU" } });
 * ```
 *
 * @public
 */
export function dynamicSystemPromptMiddleware<TContextSchema = unknown>(
  fn: (
    state: AgentBuiltInState,
    runtime: Runtime<TContextSchema>
  ) => string | Promise<string>
) {
  return createMiddleware({
    name: "DynamicSystemPromptMiddleware",
    prepareModelRequest: async (options, state, runtime) => {
      const system = await fn(
        state as AgentBuiltInState,
        runtime as Runtime<TContextSchema>
      );

      if (typeof system !== "string") {
        throw new Error(
          "dynamicSystemPromptMiddleware function must return a string"
        );
      }

      const systemMessage = new SystemMessage(system);
      return { ...options, systemMessage };
    },
  });
}
