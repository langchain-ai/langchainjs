import { SystemMessage } from "@langchain/core/messages";
import { createMiddleware } from "../middleware.js";
import { Runtime } from "../types.js";

/**
 * Dynamic Prompt Middleware
 *
 * Allows setting the system prompt dynamically right before each model invocation.
 *
 * @example
 * ```ts
 * const middleware = dynamicPromptMiddleware(async (state, runtime) => {
 *   return new SystemMessage(
 *     `You are a helpful assistant. Region: ${runtime.context.region ?? "n/a"}`
 *   );
 * });
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   middleware: [middleware],
 *   contextSchema: z.object({ region: z.string().optional() }),
 * });
 * ```
 *
 * @public
 */
export function dynamicPromptMiddleware<TContextSchema = unknown>(
  dynamicPrompt: (
    state: { messages: unknown[] },
    runtime: Runtime<TContextSchema>
  ) => SystemMessage | string | Promise<SystemMessage | string>
) {
  return createMiddleware({
    name: "DynamicPromptMiddleware",
    prepareModelRequest: async (options, state, runtime) => {
      const system = await dynamicPrompt(
        state,
        runtime as Runtime<TContextSchema>
      );
      const systemMessage =
        typeof system === "string" ? new SystemMessage(system) : system;

      return { ...options, systemMessage };
    },
  });
}
