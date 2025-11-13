/**
 * Context editing middleware.
 *
 * This middleware mirrors Anthropic's context editing capabilities by clearing
 * older tool results once the conversation grows beyond a configurable token
 * threshold. The implementation is intentionally model-agnostic so it can be used
 * with any LangChain chat model.
 */

import type { BaseMessage } from "@langchain/core/messages";
import type {
  LanguageModelLike,
  BaseLanguageModel,
} from "@langchain/core/language_models/base";
import {
  AIMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { countTokensApproximately } from "./utils.js";
import { createMiddleware } from "../middleware.js";
import {
  getProfileLimits,
  contextSizeSchema,
  keepSchema,
  type ContextSize,
  type KeepSize,
  type TokenCounter,
} from "./summarization.js";

const DEFAULT_TOOL_PLACEHOLDER = "[cleared]";
const DEFAULT_TRIGGER_TOKENS = 100_000;
const DEFAULT_KEEP = 3;

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
     * Array of messages to potentially edit (modify in-place)
     */
    messages: BaseMessage[];
    /**
     * Function to count tokens in a message array
     */
    countTokens: TokenCounter;
    /**
     * Optional model instance for model profile information
     */
    model?: LanguageModelLike;
  }): void | Promise<void>;
}

/**
 * Configuration for clearing tool outputs when token limits are exceeded.
 */
export interface ClearToolUsesEditConfig {
  /**
   * Trigger conditions for context editing.
   * Can be a single condition object (all properties must be met) or an array of conditions (any condition must be met).
   *
   * @example
   * ```ts
   * // Single condition: trigger if tokens >= 100000 AND messages >= 50
   * trigger: { tokens: 100000, messages: 50 }
   *
   * // Multiple conditions: trigger if (tokens >= 100000 AND messages >= 50) OR (tokens >= 50000 AND messages >= 100)
   * trigger: [
   *   { tokens: 100000, messages: 50 },
   *   { tokens: 50000, messages: 100 }
   * ]
   *
   * // Fractional trigger: trigger at 80% of model's max input tokens
   * trigger: { fraction: 0.8 }
   * ```
   */
  trigger?: ContextSize | ContextSize[];

  /**
   * Context retention policy applied after editing.
   * Specify how many tool results to preserve using messages, tokens, or fraction.
   *
   * @example
   * ```ts
   * // Keep 3 most recent tool results
   * keep: { messages: 3 }
   *
   * // Keep tool results that fit within 1000 tokens
   * keep: { tokens: 1000 }
   *
   * // Keep tool results that fit within 30% of model's max input tokens
   * keep: { fraction: 0.3 }
   * ```
   */
  keep?: KeepSize;

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

  /**
   * @deprecated Use `trigger: { tokens: value }` instead.
   */
  triggerTokens?: number;

  /**
   * @deprecated Use `keep: { messages: value }` instead.
   */
  keepMessages?: number;

  /**
   * @deprecated This property is deprecated and will be removed in a future version.
   * Use `keep: { tokens: value }` or `keep: { messages: value }` instead to control retention.
   */
  clearAtLeast?: number;
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
 * // New API with ContextSize
 * const edit = new ClearToolUsesEdit({
 *   trigger: { tokens: 100000 },  // Start clearing at 100K tokens
 *   keep: { messages: 3 },        // Keep 3 most recent tool results
 *   excludeTools: ["important"],   // Never clear "important" tool
 *   clearToolInputs: false,        // Keep tool call arguments
 *   placeholder: "[cleared]",      // Replacement text
 * });
 *
 * // Multiple trigger conditions
 * const edit2 = new ClearToolUsesEdit({
 *   trigger: [
 *     { tokens: 100000, messages: 50 },
 *     { tokens: 50000, messages: 100 }
 *   ],
 *   keep: { messages: 3 },
 * });
 *
 * // Fractional trigger with model profile
 * const edit3 = new ClearToolUsesEdit({
 *   trigger: { fraction: 0.8 },  // Trigger at 80% of model's max tokens
 *   keep: { fraction: 0.3 },     // Keep 30% of model's max tokens
 *   model: chatModel,
 * });
 * ```
 */
export class ClearToolUsesEdit implements ContextEdit {
  #triggerConditions: ContextSize[];

  trigger: ContextSize | ContextSize[];
  keep: KeepSize;
  clearToolInputs: boolean;
  excludeTools: Set<string>;
  placeholder: string;
  model: BaseLanguageModel;
  clearAtLeast: number;

  constructor(config: ClearToolUsesEditConfig = {}) {
    // Handle deprecated parameters
    let trigger: ContextSize | ContextSize[] | undefined = config.trigger;
    if (config.triggerTokens !== undefined) {
      console.warn(
        "triggerTokens is deprecated. Use `trigger: { tokens: value }` instead."
      );
      if (trigger === undefined) {
        trigger = { tokens: config.triggerTokens };
      }
    }

    let keep: KeepSize | undefined = config.keep;
    if (config.keepMessages !== undefined) {
      console.warn(
        "keepMessages is deprecated. Use `keep: { messages: value }` instead."
      );
      if (keep === undefined) {
        keep = { messages: config.keepMessages };
      }
    }

    // Set defaults
    if (trigger === undefined) {
      trigger = { tokens: DEFAULT_TRIGGER_TOKENS };
    }
    if (keep === undefined) {
      keep = { messages: DEFAULT_KEEP };
    }

    // Validate trigger conditions
    if (Array.isArray(trigger)) {
      this.#triggerConditions = trigger.map((t) => contextSizeSchema.parse(t));
      this.trigger = this.#triggerConditions;
    } else {
      const validated = contextSizeSchema.parse(trigger);
      this.#triggerConditions = [validated];
      this.trigger = validated;
    }

    // Validate keep
    const validatedKeep = keepSchema.parse(keep);
    this.keep = validatedKeep;

    // Handle deprecated clearAtLeast
    if (config.clearAtLeast !== undefined) {
      console.warn(
        "clearAtLeast is deprecated and will be removed in a future version. " +
          "It conflicts with the `keep` property. Use `keep: { tokens: value }` or " +
          "`keep: { messages: value }` instead to control retention."
      );
    }
    this.clearAtLeast = config.clearAtLeast ?? 0;

    this.clearToolInputs = config.clearToolInputs ?? false;
    this.excludeTools = new Set(config.excludeTools ?? []);
    this.placeholder = config.placeholder ?? DEFAULT_TOOL_PLACEHOLDER;
  }

  async apply(params: {
    messages: BaseMessage[];
    model: BaseLanguageModel;
    countTokens: TokenCounter;
  }): Promise<void> {
    const { messages, model, countTokens } = params;
    const tokens = await countTokens(messages);

    /**
     * Always remove orphaned tool messages (those without corresponding AI messages)
     * regardless of whether editing is triggered
     */
    const orphanedIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (ToolMessage.isInstance(msg)) {
        // Check if this tool message has a corresponding AI message
        const aiMessage = this.#findAIMessageForToolCall(
          messages.slice(0, i),
          msg.tool_call_id
        );

        if (!aiMessage) {
          // Orphaned tool message - mark for removal
          orphanedIndices.push(i);
        } else {
          // Check if the AI message actually has this tool call
          const toolCall = aiMessage.tool_calls?.find(
            (call) => call.id === msg.tool_call_id
          );
          if (!toolCall) {
            // Orphaned tool message - mark for removal
            orphanedIndices.push(i);
          }
        }
      }
    }

    /**
     * Remove orphaned tool messages in reverse order to maintain indices
     */
    for (let i = orphanedIndices.length - 1; i >= 0; i--) {
      messages.splice(orphanedIndices[i]!, 1);
    }

    /**
     * Recalculate tokens after removing orphaned messages
     */
    let currentTokens = tokens;
    if (orphanedIndices.length > 0) {
      currentTokens = await countTokens(messages);
    }

    /**
     * Check if editing should be triggered
     */
    if (!this.#shouldEdit(messages, currentTokens, model)) {
      return;
    }

    /**
     * Find all tool message candidates with their actual indices in the messages array
     */
    const candidates: { idx: number; msg: ToolMessage }[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (ToolMessage.isInstance(msg)) {
        candidates.push({ idx: i, msg });
      }
    }

    if (candidates.length === 0) {
      return;
    }

    /**
     * Determine how many tool results to keep based on keep policy
     */
    const keepCount = await this.#determineKeepCount(
      candidates,
      countTokens,
      model
    );

    /**
     * Keep the most recent tool messages based on keep policy
     */
    const candidatesToClear =
      keepCount >= candidates.length
        ? []
        : keepCount > 0
        ? candidates.slice(0, -keepCount)
        : candidates;

    /**
     * If clearAtLeast is set, we may need to clear more messages to meet the token requirement
     * This is a deprecated feature that conflicts with keep, but we support it for backwards compatibility
     */
    let clearedTokens = 0;
    const initialCandidatesToClear = [...candidatesToClear];

    for (const { idx, msg: toolMessage } of initialCandidatesToClear) {
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
      clearedTokens = Math.max(0, currentTokens - newTokenCount);
    }

    /**
     * If clearAtLeast is set and we haven't cleared enough tokens,
     * continue clearing more messages (going backwards from keepCount)
     * This is deprecated behavior but maintained for backwards compatibility
     */
    if (this.clearAtLeast > 0 && clearedTokens < this.clearAtLeast) {
      /**
       * Find remaining candidates that weren't cleared yet (those that were kept)
       */
      const remainingCandidates =
        keepCount > 0 && keepCount < candidates.length
          ? candidates.slice(-keepCount)
          : [];

      /**
       * Clear additional messages until we've cleared at least clearAtLeast tokens
       * Go backwards through the kept messages
       */
      for (let i = remainingCandidates.length - 1; i >= 0; i--) {
        if (clearedTokens >= this.clearAtLeast) {
          break;
        }

        const { idx, msg: toolMessage } = remainingCandidates[i]!;

        /**
         * Skip if already cleared
         */
        const contextEditing = toolMessage.response_metadata
          ?.context_editing as { cleared?: boolean } | undefined;
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
        clearedTokens = Math.max(0, currentTokens - newTokenCount);
      }
    }
  }

  /**
   * Determine whether editing should run for the current token usage
   */
  #shouldEdit(
    messages: BaseMessage[],
    totalTokens: number,
    model: BaseLanguageModel
  ): boolean {
    /**
     * Check each condition (OR logic between conditions)
     */
    for (const trigger of this.#triggerConditions) {
      /**
       * Within a single condition, all specified properties must be satisfied (AND logic)
       */
      let conditionMet = true;
      let hasAnyProperty = false;

      if (trigger.messages !== undefined) {
        hasAnyProperty = true;
        if (messages.length < trigger.messages) {
          conditionMet = false;
        }
      }

      if (trigger.tokens !== undefined) {
        hasAnyProperty = true;
        if (totalTokens < trigger.tokens) {
          conditionMet = false;
        }
      }

      if (trigger.fraction !== undefined) {
        hasAnyProperty = true;
        if (!model) {
          continue;
        }
        const maxInputTokens = getProfileLimits(model);
        if (typeof maxInputTokens === "number") {
          const threshold = Math.floor(maxInputTokens * trigger.fraction);
          if (threshold <= 0) {
            continue;
          }
          if (totalTokens < threshold) {
            conditionMet = false;
          }
        } else {
          /**
           * If fraction is specified but we can't get model limits, skip this condition
           */
          continue;
        }
      }

      /**
       * If condition has at least one property and all properties are satisfied, trigger editing
       */
      if (hasAnyProperty && conditionMet) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine how many tool results to keep based on keep policy
   */
  async #determineKeepCount(
    candidates: Array<{ idx: number; msg: ToolMessage }>,
    countTokens: TokenCounter,
    model: BaseLanguageModel
  ): Promise<number> {
    if ("messages" in this.keep && this.keep.messages !== undefined) {
      return this.keep.messages;
    }

    if ("tokens" in this.keep && this.keep.tokens !== undefined) {
      /**
       * For token-based keep, count backwards from the end until we exceed the token limit
       * This is a simplified implementation - keeping N most recent tool messages
       * A more sophisticated implementation would count actual tokens
       */
      const targetTokens = this.keep.tokens;
      let tokenCount = 0;
      let keepCount = 0;

      for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        /**
         * Estimate tokens for this tool message (simplified - could be improved)
         */
        const msgTokens = await countTokens([candidate.msg]);
        if (tokenCount + msgTokens <= targetTokens) {
          tokenCount += msgTokens;
          keepCount++;
        } else {
          break;
        }
      }

      return keepCount;
    }

    if ("fraction" in this.keep && this.keep.fraction !== undefined) {
      if (!model) {
        return DEFAULT_KEEP;
      }
      const maxInputTokens = getProfileLimits(model);
      if (typeof maxInputTokens === "number") {
        const targetTokens = Math.floor(maxInputTokens * this.keep.fraction);
        if (targetTokens <= 0) {
          return DEFAULT_KEEP;
        }
        /**
         * Use token-based logic with fractional target
         */
        let tokenCount = 0;
        let keepCount = 0;

        for (let i = candidates.length - 1; i >= 0; i--) {
          const candidate = candidates[i];
          const msgTokens = await countTokens([candidate.msg]);
          if (tokenCount + msgTokens <= targetTokens) {
            tokenCount += msgTokens;
            keepCount++;
          } else {
            break;
          }
        }

        return keepCount;
      }
    }

    return DEFAULT_KEEP;
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
 * // Single condition: trigger if tokens >= 50000 AND messages >= 20
 * const agent1 = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   tools: [searchTool, calculatorTool],
 *   middleware: [
 *     contextEditingMiddleware({
 *       edits: [
 *         new ClearToolUsesEdit({
 *           trigger: { tokens: 50000, messages: 20 },
 *           keep: { messages: 5 },
 *           excludeTools: ["search"],
 *           clearToolInputs: true,
 *         }),
 *       ],
 *       tokenCountMethod: "approx",
 *     }),
 *   ],
 * });
 *
 * // Multiple conditions: trigger if (tokens >= 50000 AND messages >= 20) OR (tokens >= 30000 AND messages >= 50)
 * const agent2 = createAgent({
 *   model: "anthropic:claude-3-5-sonnet",
 *   tools: [searchTool, calculatorTool],
 *   middleware: [
 *     contextEditingMiddleware({
 *       edits: [
 *         new ClearToolUsesEdit({
 *           trigger: [
 *             { tokens: 50000, messages: 20 },
 *             { tokens: 30000, messages: 50 },
 *           ],
 *           keep: { messages: 5 },
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 *
 * // Fractional trigger with model profile
 * const agent3 = createAgent({
 *   model: chatModel,
 *   tools: [searchTool, calculatorTool],
 *   middleware: [
 *     contextEditingMiddleware({
 *       edits: [
 *         new ClearToolUsesEdit({
 *           trigger: { fraction: 0.8 },  // Trigger at 80% of model's max tokens
 *           keep: { fraction: 0.3 },     // Keep 30% of model's max tokens
 *           model: chatModel,
 *         }),
 *       ],
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

      /**
       * Apply each edit in sequence
       */
      for (const edit of edits) {
        await edit.apply({
          messages: request.messages,
          model: request.model as BaseLanguageModel,
          countTokens,
        });
      }

      return handler(request);
    },
  });
}
