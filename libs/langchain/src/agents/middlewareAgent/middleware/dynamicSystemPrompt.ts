import { SystemMessage } from "@langchain/core/messages";
import { createMiddleware } from "../middleware.js";
import type { Runtime, AgentBuiltInState } from "../types.js";

/**
 * Dynamic Prompt Middleware
 *
 * Allows setting the system prompt dynamically right before each model invocation.
 * Useful when the prompt depends on the current agent state or per-invocation context.
 *
 * @typeParam TContextSchema - The shape of the runtime context available at invocation time.
 * If your agent defines a `contextSchema`, pass the inferred type here to get full type-safety
 * for `runtime.context`.
 *
 * @param dynamicPrompt - Function that receives the current agent `state` and `runtime`, and
 * returns the system prompt for the next model call. It can return either a `SystemMessage`
 * or a `string` (which will be wrapped in a `SystemMessage`). Supports async.
 *
 * @returns A middleware instance that sets `systemMessage` for the next model call.
 *
 * @example Basic usage with typed context
 * ```ts
 * import { z } from "zod";
 * const contextSchema = z.object({ region: z.string().optional() });
 *
 * const middleware = dynamicPromptMiddleware<z.infer<typeof contextSchema>>(
 *   (_state, runtime) =>
 *     new SystemMessage(
 *       `You are a helpful assistant. Region: ${runtime.context.region ?? "n/a"}`
 *     )
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
 * @example Returning a string instead of a SystemMessage
 * ```ts
 * const middleware = dynamicPromptMiddleware((_state, runtime) =>
 *   `You are a helpful assistant. Region: ${runtime.context.region ?? "n/a"}`
 * );
 * ```
 *
 * @public
 */
export function dynamicSystemPrompt<TContextSchema = unknown>(
  dynamicPrompt: (
    state: AgentBuiltInState,
    runtime: Runtime<TContextSchema>
  ) => SystemMessage | string | Promise<SystemMessage | string>
) {
  return createMiddleware({
    name: "DynamicPromptMiddleware",
    prepareModelRequest: async (options, state, runtime) => {
      const system = await dynamicPrompt(
        state as AgentBuiltInState,
        runtime as Runtime<TContextSchema>
      );
      const systemMessage =
        typeof system === "string" ? new SystemMessage(system) : system;

      return { ...options, systemMessage };
    },
  });
}
