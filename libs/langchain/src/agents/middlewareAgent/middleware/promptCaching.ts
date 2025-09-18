import { z } from "zod/v3";
import { ContentBlock } from "@langchain/core/messages";

import { ConfigurableModel } from "../../../chat_models/universal.js";
import { createMiddleware } from "../middleware.js";

const DEFAULT_ENABLE_CACHING = true;
const DEFAULT_TTL = "5m";
const DEFAULT_MIN_MESSAGES_TO_CACHE = 3;

const contextSchema = z.object({
  // Configuration options
  enableCaching: z.boolean().default(DEFAULT_ENABLE_CACHING),
  ttl: z.enum(["5m", "1h"]).default(DEFAULT_TTL),
  minMessagesToCache: z.number().default(DEFAULT_MIN_MESSAGES_TO_CACHE),
});

class PromptCachingMiddlewareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptCachingMiddlewareError";
  }
}

/**
 * Creates a prompt caching middleware for Anthropic models to optimize API usage.
 *
 * This middleware automatically adds cache control headers to the last messages when using Anthropic models,
 * enabling their prompt caching feature. This can significantly reduce costs for applications with repetitive
 * prompts, long system messages, or extensive conversation histories.
 *
 * ## How It Works
 *
 * The middleware intercepts model requests and adds cache control metadata that tells Anthropic's
 * API to cache processed prompt prefixes. On subsequent requests with matching prefixes, the
 * cached representations are reused, skipping redundant token processing.
 *
 * ## Benefits
 *
 * - **Cost Reduction**: Avoid reprocessing the same tokens repeatedly (up to 90% savings on cached portions)
 * - **Lower Latency**: Cached prompts are processed faster as embeddings are pre-computed
 * - **Better Scalability**: Reduced computational load enables handling more requests
 * - **Consistent Performance**: Stable response times for repetitive queries
 *
 * @param middlewareOptions - Configuration options for the caching behavior
 * @param middlewareOptions.enableCaching - Whether to enable prompt caching (default: `true`)
 * @param middlewareOptions.ttl - Cache time-to-live: `"5m"` for 5 minutes or `"1h"` for 1 hour (default: `"5m"`)
 * @param middlewareOptions.minMessagesToCache - Minimum number of messages required before caching is applied (default: `3`)
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @throws {Error} If used with non-Anthropic models
 *
 * @example
 * Basic usage with default settings
 * ```typescript
 * import { createAgent } from "langchain";
 * import { anthropicPromptCachingMiddleware } from "langchain/middleware";
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   middleware: [
 *     anthropicPromptCachingMiddleware()
 *   ]
 * });
 * ```
 *
 * @example
 * Custom configuration for longer conversations
 * ```typescript
 * const cachingMiddleware = anthropicPromptCachingMiddleware({
 *   ttl: "1h",  // Cache for 1 hour instead of default 5 minutes
 *   minMessagesToCache: 5  // Only cache after 5 messages
 * });
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   systemMessage: "You are a helpful assistant with deep knowledge of...", // Long system prompt
 *   middleware: [cachingMiddleware]
 * });
 * ```
 *
 * @example
 * Conditional caching based on runtime context
 * ```typescript
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   middleware: [
 *     anthropicPromptCachingMiddleware({
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
 *   model: "anthropic:claude-3-5-sonnet",
 *   systemMessage: `You are a customer support agent for ACME Corp.
 *
 *     Company policies:
 *     - Always be polite and professional
 *     - Refer to knowledge base for product information
 *     - Escalate billing issues to human agents
 *     ... (extensive policies and guidelines)
 *   `,
 *   tools: [searchKnowledgeBase, createTicket, checkOrderStatus],
 *   middleware: [
 *     anthropicPromptCachingMiddleware({
 *       ttl: "1h",  // Long TTL for stable system prompt
 *       minMessagesToCache: 1  // Cache immediately due to large system prompt
 *     })
 *   ]
 * });
 * ```
 *
 * @remarks
 * - **Anthropic Only**: This middleware only works with Anthropic models and will throw an error if used with other providers
 * - **Automatic Application**: Caching is applied automatically when message count exceeds `minMessagesToCache`
 * - **Cache Scope**: Caches are isolated per API key and cannot be shared across different keys
 * - **TTL Options**: Only supports "5m" (5 minutes) and "1h" (1 hour) as TTL values per Anthropic's API
 * - **Best Use Cases**: Long system prompts, multi-turn conversations, repetitive queries, RAG applications
 * - **Cost Impact**: Cached tokens are billed at 10% of the base input token price, cache writes are billed at 25% of the base
 *
 * @see {@link createAgent} for agent creation
 * @see {@link https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching} Anthropic's prompt caching documentation
 * @public
 */
export function anthropicPromptCachingMiddleware(
  middlewareOptions?: Partial<z.infer<typeof contextSchema>>
) {
  return createMiddleware({
    name: "PromptCachingMiddleware",
    contextSchema,
    modifyModelRequest: (options, state, runtime) => {
      /**
       * If the runtime values match the schema default values, use the middleware option
       * values otherwise use the runtime values. This allows to apply general configurations
       * for all invocations, and override them for specific invocations.
       */
      const enableCaching =
        runtime.context.enableCaching === DEFAULT_ENABLE_CACHING
          ? middlewareOptions?.enableCaching ?? runtime.context.enableCaching
          : runtime.context.enableCaching ?? middlewareOptions?.enableCaching;
      const ttl =
        runtime.context.ttl === DEFAULT_TTL
          ? middlewareOptions?.ttl ?? runtime.context.ttl
          : runtime.context.ttl ?? middlewareOptions?.ttl;
      const minMessagesToCache =
        runtime.context.minMessagesToCache === DEFAULT_MIN_MESSAGES_TO_CACHE
          ? middlewareOptions?.minMessagesToCache ??
            runtime.context.minMessagesToCache
          : runtime.context.minMessagesToCache ??
            middlewareOptions?.minMessagesToCache;

      // Skip if caching is disabled
      if (!enableCaching || !options.model) {
        return undefined;
      }

      if (
        !options.model ||
        /**
         * user passes in a ChatAnthropic instance
         */
        (options.model.getName() !== "ChatAnthropic" &&
          /**
           * user passes in a model via string, e.g. "anthropic:claude-3-5-sonnet"
           */
          "_defaultConfig" in options.model &&
          (options.model as ConfigurableModel)._defaultConfig?.modelProvider !==
            "anthropic")
      ) {
        throw new Error(
          "Prompt caching is only supported for Anthropic models"
        );
      }

      const messagesCount =
        state.messages.length + (options.systemMessage ? 1 : 0);

      if (messagesCount < minMessagesToCache) {
        return options;
      }

      /**
       * Add cache_control to the last message
       */
      const lastMessage = options.messages.at(-1);
      if (!lastMessage) {
        return options;
      }

      if (Array.isArray(lastMessage.content)) {
        lastMessage.content = [
          ...lastMessage.content.slice(0, -1),
          {
            ...lastMessage.content.at(-1),
            cache_control: {
              type: "ephemeral",
              ttl,
            },
          } as ContentBlock,
        ];
      } else if (typeof lastMessage.content === "string") {
        lastMessage.content = [
          {
            type: "text",
            text: lastMessage.content,
            cache_control: {
              type: "ephemeral",
              ttl,
            },
          },
        ];
      } else {
        throw new PromptCachingMiddlewareError(
          "Last message content is not a string or array"
        );
      }

      return options;
    },
  });
}
