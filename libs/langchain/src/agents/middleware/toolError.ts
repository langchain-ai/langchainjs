/**
 * Tool error middleware for agents.
 */
import { ToolMessage, type MessageContent } from "@langchain/core/messages";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { isGraphBubbleUp } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { ToolCallRequest } from "./types.js";

/**
 * Handler called when tool execution throws.
 *
 * Return content to surface the error to the model as an error `ToolMessage`.
 * Return nothing to propagate the original error.
 */
export type ToolErrorHandler = (
  error: unknown,
  request: ToolCallRequest
) => MessageContent | void | Promise<MessageContent | void>;

/**
 * Configuration for {@link toolErrorMiddleware}.
 */
export interface ToolErrorMiddlewareConfig {
  /**
   * Handler called when tool execution throws. Return content to convert the
   * error into an error `ToolMessage`, or return nothing to propagate it.
   */
  onError: ToolErrorHandler;

  /**
   * Optional tools or tool names to handle errors for. Handles all tools when
   * omitted.
   */
  tools?: Array<ClientTool | ServerTool | string>;
}

/**
 * Converts selected tool execution errors into error `ToolMessage`s.
 *
 * Handling is opt-in: {@link ToolErrorMiddlewareConfig.onError} must return
 * content for an error to be sent to the model. Returning nothing propagates
 * the original error unchanged. LangGraph control-flow signals always
 * propagate and are never passed to `onError`.
 *
 * Prefer returning content that identifies the error type without including
 * the raw error message, which may contain sensitive or internal details.
 *
 * This middleware does not retry. To retry before handling an error, place
 * `toolRetryMiddleware({ onFailure: "error" })` after this middleware.
 *
 * @example
 * ```ts
 * import { createAgent, toolErrorMiddleware } from "langchain";
 *
 * const agent = createAgent({
 *   model,
 *   tools: [searchTool],
 *   middleware: [
 *     toolErrorMiddleware({
 *       onError: (error, request) => {
 *         if (error instanceof TypeError) {
 *           return `Tool '${request.toolCall.name}' failed with TypeError.`;
 *         }
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function toolErrorMiddleware(config: ToolErrorMiddlewareConfig) {
  const toolFilter = config.tools?.map((tool) =>
    typeof tool === "string" ? tool : tool.name
  );

  return createMiddleware({
    name: "toolErrorMiddleware",
    wrapToolCall: async (request, handler) => {
      const toolName = request.tool?.name ?? request.toolCall.name;

      if (toolFilter !== undefined && !toolFilter.includes(toolName)) {
        return handler(request);
      }

      try {
        return await handler(request);
      } catch (error: unknown) {
        if (isGraphBubbleUp(error)) {
          throw error;
        }

        const content = await config.onError(error, request);
        if (content === undefined) {
          throw error;
        }

        return new ToolMessage({
          content,
          tool_call_id: request.toolCall.id ?? "",
          ...(typeof toolName === "string" ? { name: toolName } : {}),
          status: "error",
        });
      }
    },
  });
}
