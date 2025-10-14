/**
 * Context editing middleware.
 *
 * This middleware mirrors Anthropic's context editing capabilities by clearing
 * older tool results once the conversation grows beyond a configurable token
 * threshold. The implementation is intentionally model-agnostic so it can be used
 * with any LangChain chat model.
 */

import type { BaseMessage } from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  AIMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  createMiddleware,
  type AgentMiddleware as _,
} from "@langchain/core/middleware";

import { countTokensApproximately } from "./utils.js";

const DEFAULT_TOOL_PLACEHOLDER = "[cleared]";

/**
 * Function type for counting tokens in a sequence of messages.
 */
export type TokenCounter = (
  messages: BaseMessage[]
) => number | Promise<number>;

/**
 * Protocol describing a context editing strategy.
 *
 * Implement this interface to create custom strategies for managing
 * conversation context size. The `apply` method should modify the
 * messages array in-place and return the updated token count.
 *
 * @example
 * ```ts
 * import { SystemMessage } from "langchain";
 *
 * class RemoveOldSystemMessages implements ContextEdit {
 *   async apply({ tokens, messages, countTokens }) {
 *     // Remove old system messages if over limit
 *     if (tokens > 50000) {
 *       messages = messages.filter(SystemMessage.isInstance);
 *       return await countTokens(messages);
 *     }
 *     return tokens;
 *   }
 * }
 * ```
 */
export interface ContextEdit {
  /**
   * Apply an edit to the message list, returning the new token count.
   *
   * This method should:
   * 1. Check if editing is needed based on `tokens` parameter
   * 2. Modify the `messages` array in-place (if needed)
   * 3. Return the new token count after modifications
   *
   * @param params - Parameters for the editing operation
   * @returns The updated token count after applying edits
   */
  apply(params: {
    /**
     * Current token count of all messages
     */
    tokens: number;
    /**
     * Array of messages to potentially edit (modify in-place)
     */
    messages: BaseMessage[];
    /**
     * Function to count tokens in a message array
     */
    countTokens: TokenCounter;
  }): number | Promise<number>;
}

/**
 * Configuration for clearing tool outputs when token limits are exceeded.
 */
export interface ClearToolUsesEditConfig {
  /**
   * Token count that triggers the edit.
   * @default 100000
   */
  triggerTokens?: number;

  /**
   * Minimum number of tokens to reclaim when the edit runs.
   * @default 0
   */
  clearAtLeast?: number;

  /**
   * Number of most recent tool results that must be preserved.
   * @default 3
   */
  keep?: number;

  /**
   * Whether to clear the originating tool call parameters on the AI message.
   * @default false
   */
  clearToolInputs?: boolean;

  /**
   * List of tool names to exclude from clearing.
   * @default []
   */
  excludeTools?: string[];

  /**
   * Placeholder text inserted for cleared tool outputs.
   * @default "[cleared]"
   */
  placeholder?: string;
}

/**
 * Strategy for clearing tool outputs when token limits are exceeded.
 *
 * This strategy mirrors Anthropic's `clear_tool_uses_20250919` behavior by
 * replacing older tool results with a placeholder text when the conversation
 * grows too large. It preserves the most recent tool results and can exclude
 * specific tools from being cleared.
 *
 * @example
 * ```ts
 * import { ClearToolUsesEdit } from "langchain";
 *
 * const edit = new ClearToolUsesEdit({
 *   triggerTokens: 100000,       // Start clearing at 100K tokens
 *   clearAtLeast: 0,             // Clear as much as needed
 *   keep: 3,                     // Always keep 3 most recent results
 *   excludeTools: ["important"], // Never clear "important" tool
 *   clearToolInputs: false,      // Keep tool call arguments
 *   placeholder: "[cleared]",    // Replacement text
 * });
 * ```
 */
export class ClearToolUsesEdit implements ContextEdit {
  triggerTokens: number;
  clearAtLeast: number;
  keep: number;
  clearToolInputs: boolean;
  excludeTools: Set<string>;
  placeholder: string;

  constructor(config: ClearToolUsesEditConfig = {}) {
    this.triggerTokens = config.triggerTokens ?? 100000;
    this.clearAtLeast = config.clearAtLeast ?? 0;
    this.keep = config.keep ?? 3;
    this.clearToolInputs = config.clearToolInputs ?? false;
    this.excludeTools = new Set(config.excludeTools ?? []);
    this.placeholder = config.placeholder ?? DEFAULT_TOOL_PLACEHOLDER;
  }

  async apply(params: {
    tokens: number;
    messages: BaseMessage[];
    countTokens: TokenCounter;
  }): Promise<number> {
    const { tokens, messages, countTokens } = params;

    if (tokens <= this.triggerTokens) {
      return tokens;
    }

    /**
     * Find all tool message candidates with their actual indices in the messages array
     */
    const candidates: Array<{ idx: number; msg: ToolMessage }> = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (ToolMessage.isInstance(msg)) {
        candidates.push({ idx: i, msg });
      }
    }

    /**
     * Keep the most recent tool messages
     */
    const candidatesToClear =
      this.keep >= candidates.length
        ? []
        : this.keep > 0
        ? candidates.slice(0, -this.keep)
        : candidates;

    let clearedTokens = 0;
    for (const { idx, msg: toolMessage } of candidatesToClear) {
      /**
       * Stop if we've cleared enough tokens
       */
      if (this.clearAtLeast > 0 && clearedTokens >= this.clearAtLeast) {
        break;
      }

      /**
       * Skip if already cleared
       */
      const contextEditing = toolMessage.response_metadata?.context_editing as
        | { cleared?: boolean }
        | undefined;
      if (contextEditing?.cleared) {
        continue;
      }

      /**
       * Find the corresponding AI message
       */
      const aiMessage = this.#findAIMessageForToolCall(
        messages.slice(0, idx),
        toolMessage.tool_call_id
      );

      if (!aiMessage) {
        continue;
      }

      /**
       * Find the corresponding tool call
       */
      const toolCall = aiMessage.tool_calls?.find(
        (call) => call.id === toolMessage.tool_call_id
      );

      if (!toolCall) {
        continue;
      }

      /**
       * Skip if tool is excluded
       */
      const toolName = toolMessage.name || toolCall.name;
      if (this.excludeTools.has(toolName)) {
        continue;
      }

      /**
       * Clear the tool message
       */
      messages[idx] = new ToolMessage({
        tool_call_id: toolMessage.tool_call_id,
        content: this.placeholder,
        name: toolMessage.name,
        artifact: undefined,
        response_metadata: {
          ...toolMessage.response_metadata,
          context_editing: {
            cleared: true,
            strategy: "clear_tool_uses",
          },
        },
      });

      /**
       * Optionally clear the tool inputs
       */
      if (this.clearToolInputs) {
        const aiMsgIdx = messages.indexOf(aiMessage);
        if (aiMsgIdx >= 0) {
          messages[aiMsgIdx] = this.#buildClearedToolInputMessage(
            aiMessage,
            toolMessage.tool_call_id
          );
        }
      }

      /**
       * Recalculate tokens
       */
      const newTokenCount = await countTokens(messages);
      clearedTokens = Math.max(0, tokens - newTokenCount);
    }

    return tokens - clearedTokens;
  }

  #findAIMessageForToolCall(
    previousMessages: BaseMessage[],
    toolCallId: string
  ): AIMessage | null {
    // Search backwards through previous messages
    for (let i = previousMessages.length - 1; i >= 0; i--) {
      const msg = previousMessages[i];
      if (AIMessage.isInstance(msg)) {
        const hasToolCall = msg.tool_calls?.some(
          (call) => call.id === toolCallId
        );
        if (hasToolCall) {
          return msg;
        }
      }
    }
    return null;
  }

  #buildClearedToolInputMessage(
    message: AIMessage,
    toolCallId: string
  ): AIMessage {
    const updatedToolCalls = message.tool_calls?.map((toolCall) => {
      if (toolCall.id === toolCallId) {
        return { ...toolCall, args: {} };
      }
      return toolCall;
    });

    const metadata = { ...message.response_metadata };
    const contextEntry = {
      ...(metadata.context_editing as Record<string, unknown>),
    };

    const clearedIds = new Set<string>(
      contextEntry.cleared_tool_inputs as string[] | undefined
    );
    clearedIds.add(toolCallId);
    contextEntry.cleared_tool_inputs = Array.from(clearedIds).sort();
    metadata.context_editing = contextEntry;

    return new AIMessage({
      content: message.content,
      tool_calls: updatedToolCalls,
      response_metadata: metadata,
      id: message.id,
      name: message.name,
      additional_kwargs: message.additional_kwargs,
    });
  }
}

/**
 * Configuration for the Context Editing Middleware.
 */
export interface ContextEditingMiddlewareConfig {
  /**
   * Sequence of edit strategies to apply. Defaults to a single
   * ClearToolUsesEdit mirroring Anthropic defaults.
   */
  edits?: ContextEdit[];

  /**
   * Whether to use approximate token counting (faster, less accurate)
   * or exact counting implemented by the chat model (potentially slower, more accurate).
   * Currently only OpenAI models support exact counting.
   * @default "approx"
   */
  tokenCountMethod?: "approx" | "model";
}

/**
 * Middleware that automatically prunes tool results to manage context size.
 *
 * This middleware applies a sequence of edits when the total input token count
 * exceeds configured thresholds. By default, it uses the `ClearToolUsesEdit` strategy
 * which mirrors Anthropic's `clear_tool_uses_20250919` behaviour by clearing older
 * tool results once the conversation exceeds 100,000 tokens.
 *
 * ## Basic Usage
 *
 * Use the middleware with default settings to automatically manage context:
 *
 * @example Basic usage with defaults
 * ```ts
 * import { contextEditingMiddleware } from "langchain";
 * import { createAgent } from "langchain";
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   tools: [searchTool, calculatorTool],
 *   middleware: [
 *     contextEditingMiddleware(),
 *   ],
 * });
 * ```
 *
 * The default configuration:
 * - Triggers when context exceeds **100,000 tokens**
 * - Keeps the **3 most recent** tool results
 * - Uses **approximate token counting** (fast)
 * - Does not clear tool call arguments
 *
 * ## Custom Configuration
 *
 * Customize the clearing behavior with `ClearToolUsesEdit`:
 *
 * @example Custom ClearToolUsesEdit configuration
 * ```ts
 * import { contextEditingMiddleware, ClearToolUsesEdit } from "langchain";
 *
 * const agent = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   tools: [searchTool, calculatorTool],
 *   middleware: [
 *     contextEditingMiddleware({
 *       edits: [
 *         new ClearToolUsesEdit({
 *           triggerTokens: 50000,      // Clear when exceeding 50K tokens
 *           clearAtLeast: 1000,         // Reclaim at least 1K tokens
 *           keep: 5,                    // Keep 5 most recent tool results
 *           excludeTools: ["search"],   // Never clear search results
 *           clearToolInputs: true,      // Also clear tool call arguments
 *         }),
 *       ],
 *       tokenCountMethod: "approx",     // Use approximate counting (or "model")
 *     }),
 *   ],
 * });
 * ```
 *
 * ## Custom Editing Strategies
 *
 * Implement your own context editing strategy by creating a class that
 * implements the `ContextEdit` interface:
 *
 * @example Custom editing strategy
 * ```ts
 * import { contextEditingMiddleware, type ContextEdit, type TokenCounter } from "langchain";
 * import type { BaseMessage } from "@langchain/core/messages";
 *
 * class CustomEdit implements ContextEdit {
 *   async apply(params: {
 *     tokens: number;
 *     messages: BaseMessage[];
 *     countTokens: TokenCounter;
 *   }): Promise<number> {
 *     // Implement your custom editing logic here
 *     // and apply it to the messages array, then
 *     // return the new token count after edits
 *     return countTokens(messages);
 *   }
 * }
 * ```
 *
 * @param config - Configuration options for the middleware
 * @returns A middleware instance that can be used with `createAgent`
 */
export function contextEditingMiddleware(
  config: ContextEditingMiddlewareConfig = {}
) {
  const edits = config.edits ?? [new ClearToolUsesEdit()];
  const tokenCountMethod = config.tokenCountMethod ?? "approx";

  return createMiddleware({
    name: "ContextEditingMiddleware",
    wrapModelCall: async (request, handler) => {
      if (!request.messages || request.messages.length === 0) {
        return handler(request);
      }

      /**
       * Use model's token counting method
       */
      const systemMsg = request.systemPrompt
        ? [new SystemMessage(request.systemPrompt)]
        : [];

      const countTokens: TokenCounter =
        tokenCountMethod === "approx"
          ? countTokensApproximately
          : async (messages: BaseMessage[]): Promise<number> => {
              const allMessages = [...systemMsg, ...messages];

              /**
               * Check if model has getNumTokensFromMessages method
               * currently only OpenAI models have this method
               */
              if ("getNumTokensFromMessages" in request.model) {
                return (
                  request.model as LanguageModelLike & {
                    getNumTokensFromMessages: (
                      messages: BaseMessage[]
                    ) => Promise<{
                      totalCount: number;
                      countPerMessage: number[];
                    }>;
                  }
                )
                  .getNumTokensFromMessages(allMessages)
                  .then(({ totalCount }) => totalCount);
              }

              throw new Error(
                `Model "${request.model.getName()}" does not support token counting`
              );
            };

      let tokens = await countTokens(request.messages);

      /**
       * Apply each edit in sequence
       */
      for (const edit of edits) {
        tokens = await edit.apply({
          tokens,
          messages: request.messages,
          countTokens,
        });
      }

      return handler(request);
    },
  });
}
