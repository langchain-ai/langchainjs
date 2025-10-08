import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { initChatModel } from "../../chat_models/universal.js";
import type { ModelRequest } from "../nodes/types.js";
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
    retryModelRequest: async (
      _error,
      request,
      _state,
      _runtime,
      attempt
    ): Promise<ModelRequest | undefined> => {
      /**
       * attempt 1 = primary model failed, try models[0] (first fallback)
       */
      const fallbackIndex = attempt - 1;

      /**
       * All fallback models exhausted
       */
      if (fallbackIndex >= fallbackModels.length) {
        return undefined;
      }

      /**
       * Get or initialize the fallback model
       */
      const fallbackModel = fallbackModels[fallbackIndex];
      const model =
        typeof fallbackModel === "string"
          ? await initChatModel(fallbackModel)
          : fallbackModel;

      /**
       * Try next fallback model
       */
      return {
        ...request,
        model,
      };
    },
  });
}
