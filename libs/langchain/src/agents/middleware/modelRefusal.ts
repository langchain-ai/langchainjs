import { ModelRefusalError } from "@langchain/core/errors";
import {
  AIMessage,
  type BaseMessage,
  type ContentBlock,
} from "@langchain/core/messages";

import { MiddlewareError, StructuredOutputParsingError } from "../errors.js";
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
 * The `StructuredOutputParsingError` behind `error`, if any.
 *
 * Middleware listed after this one wraps errors in `MiddlewareError`, so the
 * parsing error can sit further down the `cause` chain.
 */
function parsingError(
  error: unknown
): StructuredOutputParsingError | undefined {
  let current = error;
  while (MiddlewareError.isInstance(current)) current = current.cause;
  return current instanceof StructuredOutputParsingError ? current : undefined;
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
        throwIfRefused(parsingError(error)?.aiMessage);
        throw error;
      }
      // A parsed structured response comes back as `{ structuredResponse, messages }`.
      const messages: unknown[] = AIMessage.isInstance(response)
        ? [response]
        : ((response as { messages?: unknown[] }).messages ?? []);
      for (const message of messages) {
        if (AIMessage.isInstance(message)) throwIfRefused(message);
      }
      return response;
    },
  });
}
