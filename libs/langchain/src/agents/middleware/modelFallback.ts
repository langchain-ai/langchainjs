import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { initChatModel } from "../../chat_models/universal.js";
import type { AgentMiddleware } from "./types.js";
import { createMiddleware } from "../middleware.js";

/**
 * Middleware that provides automatic model fallback on errors.
 *
 * This middleware attempts to retry failed model calls with alternative models
 * in sequence. When a model call fails, it tries the next model in the fallback
 * list until either a call succeeds or all models have been exhausted.
 *
 * @example
 * ```ts
 * import { createAgent, modelFallbackMiddleware } from "langchain";
 *
 * // Create middleware with fallback models (not including primary)
 * const fallback = modelFallbackMiddleware({
 *   "openai:gpt-4o-mini",  // First fallback
 *   "anthropic:claude-3-5-sonnet-20241022",  // Second fallback
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",  // Primary model
 *   middleware: [fallback],
 *   tools: [],
 * });
 *
 * // If gpt-4o fails, automatically tries gpt-4o-mini, then claude
 * const result = await agent.invoke({
 *   messages: [{ role: "user", content: "Hello" }]
 * });
 * ```
 *
 * @param fallbackModels - The fallback models to try, in order.
 * @returns A middleware instance that handles model failures with fallbacks
 */
export function modelFallbackMiddleware(
  /**
   * The fallback models to try, in order.
   */
  ...fallbackModels: (string | LanguageModelLike)[]
): AgentMiddleware {
  return createMiddleware({
    name: "modelFallbackMiddleware",
    wrapModelRequest: async (request, handler) => {
      /**
       * Try the primary model first
       */
      try {
        return await handler(request);
      } catch (error) {
        /**
         * If primary model fails, try fallback models in sequence
         */
        for (let i = 0; i < fallbackModels.length; i++) {
          try {
            const fallbackModel = fallbackModels[i];
            const model =
              typeof fallbackModel === "string"
                ? await initChatModel(fallbackModel)
                : fallbackModel;

            return await handler({
              ...request,
              model,
            });
          } catch (fallbackError) {
            /**
             * If this is the last fallback, throw the error
             */
            if (i === fallbackModels.length - 1) {
              throw fallbackError;
            }
            // Otherwise, continue to next fallback
          }
        }
        /**
         * If no fallbacks were provided, re-throw the original error
         */
        throw error;
      }
    },
  });
}
