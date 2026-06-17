import { z } from "zod/v3";
import { InferInteropZodInput } from "@langchain/core/utils/types";

import type { ConfigurableModel } from "../../../../chat_models/universal.js";
import { createMiddleware } from "../../../middleware.js";

const DEFAULT_ENABLE_CACHING = true;
const DEFAULT_TTL = "5m";
const DEFAULT_MIN_MESSAGES_TO_CACHE = 1;
const DEFAULT_UNSUPPORTED_MODEL_BEHAVIOR = "warn";

const contextSchema = z.object({
  /**
   * Whether to enable prompt caching.
   * @default true
   */
  enableCaching: z.boolean().optional(),
  /**
   * The time-to-live for the cached prompt.
   * @default "5m"
   */
  ttl: z.enum(["5m", "1h"]).optional(),
  /**
   * The minimum number of messages required before caching is applied.
   * @default 1
   */
  minMessagesToCache: z.number().optional(),
  /**
   * The behavior to take when an unsupported model is used.
   * - "ignore" will ignore the unsupported model and continue without caching.
   * - "warn" will warn the user and continue without caching.
   * - "raise" will raise an error and stop the agent.
   * @default "warn"
   */
  unsupportedModelBehavior: z.enum(["ignore", "warn", "raise"]).optional(),
});
export type BedrockConversePromptCachingMiddlewareConfig = Partial<
  InferInteropZodInput<typeof contextSchema>
>;

class BedrockPromptCachingMiddlewareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BedrockPromptCachingMiddlewareError";
  }
}

/**
 * Creates a prompt caching middleware for AWS Bedrock Converse models to optimize API usage.
 *
 * This middleware automatically enables Bedrock's prompt caching when using AWS Bedrock Converse
 * models. This can significantly reduce costs for applications with repetitive prompts, long
 * system messages, or extensive conversation histories.
 *
 * ## How It Works
 *
 * The middleware intercepts model requests and sets a cache control signal that
 * `ChatBedrockConverse` translates into Bedrock `cachePoint` breakpoints. Cache points are
 * inserted after the system prompt, after the tool definitions, and after the final message, so
 * the stable prefix of each request is cached. On subsequent requests with a matching prefix, the
 * cached representations are reused, skipping redundant token processing. Exact placement varies
 * by model (e.g. Amazon Nova models cache fewer breakpoints and ignore the `"1h"` TTL).
 *
 * ## Benefits
 *
 * - **Cost Reduction**: Avoid reprocessing the same tokens repeatedly
 * - **Lower Latency**: Cached prompts are processed faster as embeddings are pre-computed
 * - **Better Scalability**: Reduced computational load enables handling more requests
 * - **Consistent Performance**: Stable response times for repetitive queries
 *
 * @param middlewareOptions - Configuration options for the caching behavior
 * @param middlewareOptions.enableCaching - Whether to enable prompt caching (default: `true`)
 * @param middlewareOptions.ttl - Cache time-to-live: `"5m"` for 5 minutes or `"1h"` for 1 hour (default: `"5m"`)
 * @param middlewareOptions.minMessagesToCache - Minimum number of messages required before caching is applied (default: `1`)
 * @param middlewareOptions.unsupportedModelBehavior - The behavior to take when an unsupported model is used (default: `"warn"`)
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @throws {Error} If used with a non-Bedrock-Converse model and `unsupportedModelBehavior` is `"raise"`
 *
 * @example
 * Basic usage with default settings
 * ```typescript
 * import { createAgent } from "langchain";
 * import { bedrockPromptCachingMiddleware } from "langchain";
 *
 * const agent = createAgent({
 *   model: "bedrock:anthropic.claude-haiku-4-5-20251001-v1:0",
 *   middleware: [
 *     bedrockPromptCachingMiddleware()
 *   ]
 * });
 * ```
 *
 * @example
 * Custom configuration for longer conversations
 * ```typescript
 * const cachingMiddleware = bedrockPromptCachingMiddleware({
 *   ttl: "1h",  // Cache for 1 hour instead of default 5 minutes
 *   minMessagesToCache: 5  // Only cache after 5 messages
 * });
 *
 * const agent = createAgent({
 *   model: "bedrock:anthropic.claude-haiku-4-5-20251001-v1:0",
 *   systemPrompt: "You are a helpful assistant with deep knowledge of...", // Long system prompt
 *   middleware: [cachingMiddleware]
 * });
 * ```
 *
 * @example
 * Conditional caching based on runtime context
 * ```typescript
 * const agent = createAgent({
 *   model: "bedrock:anthropic.claude-haiku-4-5-20251001-v1:0",
 *   middleware: [
 *     bedrockPromptCachingMiddleware({
 *       enableCaching: true,
 *       ttl: "5m"
 *     })
 *   ]
 * });
 *
 * // Disable caching for specific requests
 * await agent.invoke(
 *   { messages: [new HumanMessage("Process this without caching")] },
 *   {
 *     configurable: {
 *       middleware_context: { enableCaching: false }
 *     }
 *   }
 * );
 * ```
 *
 * @example
 * Optimal setup for customer support chatbot
 * ```typescript
 * const supportAgent = createAgent({
 *   model: "bedrock:anthropic.claude-haiku-4-5-20251001-v1:0",
 *   systemPrompt: `You are a customer support agent for ACME Corp.
 *
 *     Company policies:
 *     - Always be polite and professional
 *     - Refer to knowledge base for product information
 *     - Escalate billing issues to human agents
 *     ... (extensive policies and guidelines)
 *   `,
 *   tools: [searchKnowledgeBase, createTicket, checkOrderStatus],
 *   middleware: [
 *     bedrockPromptCachingMiddleware({
 *       ttl: "1h",  // Long TTL for stable system prompt
 *       minMessagesToCache: 1  // Cache immediately due to large system prompt
 *     })
 *   ]
 * });
 * ```
 *
 * @remarks
 * - **Bedrock Converse Only**: This middleware only works with AWS Bedrock Converse models and will throw an error (when `unsupportedModelBehavior` is `"raise"`) if used with other providers
 * - **Automatic Application**: Caching is applied automatically when the message count reaches `minMessagesToCache`
 * - **TTL Options**: Only supports "5m" (5 minutes) and "1h" (1 hour) as TTL values; actual support varies by model
 * - **Best Use Cases**: Long system prompts, multi-turn conversations, repetitive queries, RAG applications
 * - **Model Support**: Prompt caching availability and pricing depend on the specific Bedrock model
 *
 * @see {@link createAgent} for agent creation
 * @see {@link https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html} AWS Bedrock prompt caching documentation
 * @public
 */
export function bedrockPromptCachingMiddleware(
  middlewareOptions?: BedrockConversePromptCachingMiddlewareConfig
) {
  return createMiddleware({
    name: "BedrockPromptCachingMiddleware",
    contextSchema,
    wrapModelCall: (request, handler) => {
      /**
       * Prefer runtime context values over middleware options values over defaults
       */
      const enableCaching =
        request.runtime.context.enableCaching ??
        middlewareOptions?.enableCaching ??
        DEFAULT_ENABLE_CACHING;
      const ttl =
        request.runtime.context.ttl ?? middlewareOptions?.ttl ?? DEFAULT_TTL;
      const minMessagesToCache =
        request.runtime.context.minMessagesToCache ??
        middlewareOptions?.minMessagesToCache ??
        DEFAULT_MIN_MESSAGES_TO_CACHE;
      const unsupportedModelBehavior =
        request.runtime.context.unsupportedModelBehavior ??
        middlewareOptions?.unsupportedModelBehavior ??
        DEFAULT_UNSUPPORTED_MODEL_BEHAVIOR;

      // Skip if caching is disabled
      if (!enableCaching || !request.model) {
        return handler(request);
      }

      const isBedrockConverseModel =
        request.model.getName() === "ChatBedrockConverse" ||
        (request.model.getName() === "ConfigurableModel" &&
          ((request.model as ConfigurableModel)._defaultConfig
            ?.modelProvider === "bedrock" ||
            (request.model as ConfigurableModel)._defaultConfig
              ?.modelProvider === "aws"));
      if (!isBedrockConverseModel) {
        // Get model name for better error context
        const modelName = request.model.getName();
        const modelInfo =
          request.model.getName() === "ConfigurableModel"
            ? `${modelName} (${
                (request.model as ConfigurableModel)._defaultConfig
                  ?.modelProvider
              })`
            : modelName;

        const baseMessage = `Unsupported model '${modelInfo}'. Prompt caching requires an AWS Bedrock Converse model`;

        if (unsupportedModelBehavior === "raise") {
          throw new BedrockPromptCachingMiddlewareError(
            `${baseMessage} (e.g., 'bedrock:anthropic.claude-haiku-4-5-20251001-v1:0').`
          );
        } else if (unsupportedModelBehavior === "warn") {
          console.warn(
            `BedrockPromptCachingMiddleware: Skipping caching for ${modelName}. Consider switching to an AWS Bedrock Converse model for caching benefits.`
          );
        }
        return handler(request);
      }

      const messagesCount =
        request.state.messages.length + (request.systemPrompt ? 1 : 0);

      if (messagesCount < minMessagesToCache) {
        return handler(request);
      }

      /**
       * The cache_control is applied at the final message formatting layer in
       * ChatBedrockConverse (translated into Converse `cachePoint` blocks), which avoids
       * issues with message content block manipulation during earlier processing stages
       * (e.g., streaming response reassembly).
       *
       * @see https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
       */
      return handler({
        ...request,
        modelSettings: {
          ...request.modelSettings,
          cache_control: {
            type: "ephemeral" as const,
            ttl,
          },
        },
      });
    },
  });
}
