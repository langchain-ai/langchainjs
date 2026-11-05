import { ModelRefusalError } from "@langchain/core/errors";
import type { BaseMessage, ContentBlock } from "@langchain/core/messages";

import { StructuredOutputParsingError } from "../errors.js";
import { createMiddleware } from "../middleware.js";

function throwIfRefused(message: BaseMessage | undefined): void {
  if (!message) return;
  for (const block of message.contentBlocks) {
    if (block.type === "refusal") {
      throw ModelRefusalError.fromRefusal(
        block as ContentBlock.Refusal,
        message
      );
    }
  }
}

/**
 * Middleware that throws {@link ModelRefusalError} when the model refuses.
 *
 * Providers report a refusal, such as a safety-policy refusal, as a successful
 * response, so without this middleware the agent run ends as if it succeeded.
 * The middleware checks each model response for a `refusal` content block,
 * including refusals that fail to parse under a structured `responseFormat`.
 * It does not detect refusals the model writes as ordinary text.
 *
 * List it after {@link modelFallbackMiddleware} so the fallback catches the
 * error and retries the request on the next model. `modelRetryMiddleware` does
 * not retry refusals.
 *
 * @example
 * ```ts
 * import {
 *   createAgent,
 *   modelFallbackMiddleware,
 *   modelRefusalMiddleware,
 * } from "langchain";
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-sonnet-5-5",
 *   tools: [],
 *   middleware: [
 *     modelFallbackMiddleware("openai:gpt-6.1-sol"),
 *     modelRefusalMiddleware(),
 *   ],
 * });
 * ```
 */
export function modelRefusalMiddleware() {
  return createMiddleware({
    name: "modelRefusalMiddleware",
    wrapModelCall: async (request, handler) => {
      let response;
      try {
        response = await handler(request);
      } catch (error) {
        if (error instanceof StructuredOutputParsingError) {
          throwIfRefused(error.aiMessage);
        }
        throw error;
      }
      throwIfRefused(response);
      return response;
    },
  });
}
