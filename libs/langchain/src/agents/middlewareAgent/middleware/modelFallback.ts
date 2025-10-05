import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { initChatModel } from "../../../chat_models/universal.js";
import type { ModelRequest, AgentMiddleware } from "../types.js";
import { createMiddleware } from "../middleware.js";

/**
 * Configuration options for the model fallback middleware.
 */
export interface ModelFallbackMiddlewareConfig {
  /**
   * The first fallback model to try when the primary model fails.
   * Can be a model name string or a LanguageModelLike instance.
   */
  firstModel: string | LanguageModelLike;
  /**
   * Additional fallback models to try, in order.
   * Can be model name strings or LanguageModelLike instances.
   */
  additionalModels?: (string | LanguageModelLike)[];
}

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
 *   firstModel: "openai:gpt-4o-mini",  // First fallback
 *   additionalModels: ["anthropic:claude-3-5-sonnet-20241022"],  // Second fallback
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",  // Primary model
 *   middleware: [fallback],
 *   tools: [],
 * });
 *
 * // If gpt-4o fails, automatically tries gpt-4o-mini, then claude
 * const result = await agent.invoke({ messages: [{ role: "user", content: "Hello" }] });
 * ```
 *
 * @param config - Configuration for the model fallback middleware
 * @returns A middleware instance that handles model failures with fallbacks
 */
export function modelFallbackMiddleware(
  config: ModelFallbackMiddlewareConfig
): AgentMiddleware {
  const { firstModel, additionalModels = [] } = config;

  // Store models (both strings and instances)
  const allModels = [firstModel, ...additionalModels];

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
      if (fallbackIndex >= allModels.length) {
        return undefined;
      }

      /**
       * Get or initialize the fallback model
       */
      const fallbackModel = allModels[fallbackIndex];
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
