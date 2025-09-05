import { z } from "zod";
import { createMiddleware } from "../middleware.js";

const contextSchema = z.object({
  // Configuration options
  enableCaching: z.boolean().default(true),
  ttl: z.enum(["5m", "1h"]).default("5m"),
  minMessagesToCache: z.number().default(3),
});

/**
 * Prompt Caching Middleware
 *
 * This middleware adds cache_control blocks to messages to enable Anthropic's
 * prompt caching feature, reducing costs and latency for repetitive prompts.
 *
 * @param middlewareOptions - Middleware options
 * @param middlewareOptions.enableCaching - Whether to enable caching
 * @param middlewareOptions.ttl - The TTL for the cached messages
 * @param middlewareOptions.minMessagesToCache - The minimum number of messages to cache
 * @returns A middleware instance
 */
export function anthropicPromptCachingMiddleware(
  middlewareOptions: Partial<z.infer<typeof contextSchema>>
) {
  return createMiddleware({
    name: "PromptCachingMiddleware",
    contextSchema,
    prepareModelRequest: (options, _, runtime) => {
      const enableCaching =
        runtime.context.enableCaching ?? middlewareOptions.enableCaching;
      const ttl = runtime.context.ttl ?? middlewareOptions.ttl;
      const minMessagesToCache =
        runtime.context.minMessagesToCache ??
        middlewareOptions.minMessagesToCache;

      // Skip if caching is disabled
      if (!enableCaching) {
        return undefined;
      }

      if (options.model?.getName() !== "anthropic") {
        throw new Error(
          "Prompt caching is only supported for Anthropic models"
        );
      }

      const messagesCount =
        options.messages.length + (options.systemMessage ? 1 : 0);

      if (messagesCount < minMessagesToCache) {
        return options;
      }

      return {
        ...options,
        modelSettings: {
          cache_control: {
            type: "ephemeral",
            ttl: ttl,
          },
        },
      };
    },
  });
}
