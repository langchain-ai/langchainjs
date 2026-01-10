import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { v4 as uuid } from "uuid";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  RemoveMessage,
  trimMessages,
  HumanMessage,
  getBufferString,
} from "@langchain/core/messages";
import {
  BaseLanguageModel,
  getModelContextSize,
} from "@langchain/core/language_models/base";
import {
  interopSafeParse,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";
import { createMiddleware } from "../middleware.js";
import { countTokensApproximately } from "./utils.js";
import { hasToolCalls } from "../utils.js";
import { initChatModel } from "../../chat_models/universal.js";

export const DEFAULT_SUMMARY_PROMPT = `<role>
Context Extraction Assistant
</role>

<primary_objective>
Your sole objective in this task is to extract the highest quality/most relevant context from the conversation history below.
</primary_objective>

<objective_information>
You're nearing the total number of input tokens you can accept, so you must extract the highest quality/most relevant pieces of information from your conversation history.
This context will then overwrite the conversation history presented below. Because of this, ensure the context you extract is only the most important information to your overall goal.
</objective_information>

<instructions>
The conversation history below will be replaced with the context you extract in this step. Because of this, you must do your very best to extract and record all of the most important context from the conversation history.
You want to ensure that you don't repeat any actions you've already completed, so the context you extract from the conversation history should be focused on the most important information to your overall goal.
</instructions>

The user will message you with the full message history you'll be extracting context from, to then replace. Carefully read over it all, and think deeply about what information is most important to your overall goal that should be saved:

With all of this in mind, please carefully read over the entire conversation history, and extract the most important and relevant context to replace it so that you can free up space in the conversation history.
Respond ONLY with the extracted context. Do not include any additional information, or text before or after the extracted context.

<messages>
Messages to summarize:
{messages}
</messages>`;

const DEFAULT_SUMMARY_PREFIX = "Here is a summary of the conversation to date:";
const DEFAULT_MESSAGES_TO_KEEP = 20;
const DEFAULT_TRIM_TOKEN_LIMIT = 4000;
const DEFAULT_FALLBACK_MESSAGE_COUNT = 15;
const SEARCH_RANGE_FOR_TOOL_PAIRS = 5;

const tokenCounterSchema = z
  .function()
  .args(z.array(z.custom<BaseMessage>()))
  .returns(z.union([z.number(), z.promise(z.number())]));
export type TokenCounter = (
  messages: BaseMessage[]
) => number | Promise<number>;

export const contextSizeSchema = z
  .object({
    /**
     * Fraction of the model's context size to use as the trigger
     */
    fraction: z
      .number()
      .gt(0, "Fraction must be greater than 0")
      .max(1, "Fraction must be less than or equal to 1")
      .optional(),
    /**
     * Number of tokens to use as the trigger
     */
    tokens: z.number().positive("Tokens must be greater than 0").optional(),
    /**
     * Number of messages to use as the trigger
     */
    messages: z
      .number()
      .int("Messages must be an integer")
      .positive("Messages must be greater than 0")
      .optional(),
  })
  .refine(
    (data) => {
      const count = [data.fraction, data.tokens, data.messages].filter(
        (v) => v !== undefined
      ).length;
      return count >= 1;
    },
    {
      message: "At least one of fraction, tokens, or messages must be provided",
    }
  );
export type ContextSize = z.infer<typeof contextSizeSchema>;

export const keepSchema = z
  .object({
    /**
     * Fraction of the model's context size to keep
     */
    fraction: z
      .number()
      .min(0, "Messages must be non-negative")
      .max(1, "Fraction must be less than or equal to 1")
      .optional(),
    /**
     * Number of tokens to keep
     */
    tokens: z
      .number()
      .min(0, "Tokens must be greater than or equal to 0")
      .optional(),
    messages: z
      .number()
      .int("Messages must be an integer")
      .min(0, "Messages must be non-negative")
      .optional(),
  })
  .refine(
    (data) => {
      const count = [data.fraction, data.tokens, data.messages].filter(
        (v) => v !== undefined
      ).length;
      return count === 1;
    },
    {
      message: "Exactly one of fraction, tokens, or messages must be provided",
    }
  );
export type KeepSize = z.infer<typeof keepSchema>;

const contextSchema = z.object({
  /**
   * Model to use for summarization
   */
  model: z.custom<string | BaseLanguageModel>(),
  /**
   * Trigger conditions for summarization.
   * Can be a single condition object (all properties must be met) or an array of conditions (any condition must be met).
   *
   * @example
   * ```ts
   * // Single condition: trigger if tokens >= 5000 AND messages >= 3
   * trigger: { tokens: 5000, messages: 3 }
   *
   * // Multiple conditions: trigger if (tokens >= 5000 AND messages >= 3) OR (tokens >= 3000 AND messages >= 6)
   * trigger: [
   *   { tokens: 5000, messages: 3 },
   *   { tokens: 3000, messages: 6 }
   * ]
   * ```
   */
  trigger: z.union([contextSizeSchema, z.array(contextSizeSchema)]).optional(),
  /**
   * Keep conditions for summarization
   */
  keep: keepSchema.optional(),
  /**
   * Token counter function to use for summarization
   */
  tokenCounter: tokenCounterSchema.optional(),
  /**
   * Summary prompt to use for summarization
   * @default {@link DEFAULT_SUMMARY_PROMPT}
   */
  summaryPrompt: z.string().default(DEFAULT_SUMMARY_PROMPT),
  /**
   * Number of tokens to trim to before summarizing
   */
  trimTokensToSummarize: z.number().optional(),
  /**
   * Prefix to add to the summary
   */
  summaryPrefix: z.string().optional(),
  /**
   * @deprecated Use `trigger: { tokens: value }` instead.
   */
  maxTokensBeforeSummary: z.number().optional(),
  /**
   * @deprecated Use `keep: { messages: value }` instead.
   */
  messagesToKeep: z.number().optional(),
});

export type SummarizationMiddlewareConfig = InferInteropZodInput<
  typeof contextSchema
>;

/**
 * Get max input tokens from model profile or fallback to model name lookup
 */
export function getProfileLimits(input: BaseLanguageModel): number | undefined {
  // Access maxInputTokens on the model profile directly if available
  if (
    "profile" in input &&
    typeof input.profile === "object" &&
    input.profile &&
    "maxInputTokens" in input.profile &&
    (typeof input.profile.maxInputTokens === "number" ||
      input.profile.maxInputTokens == null)
  ) {
    return input.profile.maxInputTokens ?? undefined;
  }

  // Fallback to using model name if available
  if ("model" in input && typeof input.model === "string") {
    return getModelContextSize(input.model);
  }
  if ("modelName" in input && typeof input.modelName === "string") {
    return getModelContextSize(input.modelName);
  }

  return undefined;
}

/**
 * Summarization middleware that automatically summarizes conversation history when token limits are approached.
 *
 * This middleware monitors message token counts and automatically summarizes older
 * messages when a threshold is reached, preserving recent messages and maintaining
 * context continuity by ensuring AI/Tool message pairs remain together.
 *
 * @param options Configuration options for the summarization middleware
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * import { summarizationMiddleware } from "langchain";
 * import { createAgent } from "langchain";
 *
 * // Single condition: trigger if tokens >= 4000 AND messages >= 10
 * const agent1 = createAgent({
 *   llm: model,
 *   tools: [getWeather],
 *   middleware: [
 *     summarizationMiddleware({
 *       model: new ChatOpenAI({ model: "gpt-4o" }),
 *       trigger: { tokens: 4000, messages: 10 },
 *       keep: { messages: 20 },
 *     })
 *   ],
 * });
 *
 * // Multiple conditions: trigger if (tokens >= 5000 AND messages >= 3) OR (tokens >= 3000 AND messages >= 6)
 * const agent2 = createAgent({
 *   llm: model,
 *   tools: [getWeather],
 *   middleware: [
 *     summarizationMiddleware({
 *       model: new ChatOpenAI({ model: "gpt-4o" }),
 *       trigger: [
 *         { tokens: 5000, messages: 3 },
 *         { tokens: 3000, messages: 6 },
 *       ],
 *       keep: { messages: 20 },
 *     })
 *   ],
 * });
 *
 * ```
 */
export function summarizationMiddleware(
  options: SummarizationMiddlewareConfig
) {
  /**
   * Parse user options to get their explicit values
   */
  const { data: userOptions, error } = interopSafeParse(contextSchema, options);
  if (error) {
    throw new Error(
      `Invalid summarization middleware options: ${z4.prettifyError(error)}`
    );
  }

  return createMiddleware({
    name: "SummarizationMiddleware",
    contextSchema: contextSchema.extend({
      /**
       * `model` should be required when initializing the middleware,
       * but can be omitted within context when invoking the middleware.
       */
      model: z.custom<BaseLanguageModel>().optional(),
    }),
    beforeModel: async (state, runtime) => {
      let trigger: ContextSize | ContextSize[] | undefined =
        userOptions.trigger;
      let keep: ContextSize = userOptions.keep as InferInteropZodOutput<
        typeof keepSchema
      >;

      /**
       * Handle deprecated parameters
       */
      if (userOptions.maxTokensBeforeSummary !== undefined) {
        console.warn(
          "maxTokensBeforeSummary is deprecated. Use `trigger: { tokens: value }` instead."
        );
        if (trigger === undefined) {
          trigger = { tokens: userOptions.maxTokensBeforeSummary };
        }
      }

      /**
       * Handle deprecated parameters
       */
      if (userOptions.messagesToKeep !== undefined) {
        console.warn(
          "messagesToKeep is deprecated. Use `keep: { messages: value }` instead."
        );
        if (
          !keep ||
          (keep &&
            "messages" in keep &&
            keep.messages === DEFAULT_MESSAGES_TO_KEEP)
        ) {
          keep = { messages: userOptions.messagesToKeep };
        }
      }

      /**
       * Merge context with user options
       */
      const resolvedTrigger =
        runtime.context?.trigger !== undefined
          ? runtime.context.trigger
          : trigger;
      const resolvedKeep =
        runtime.context?.keep !== undefined
          ? runtime.context.keep
          : (keep ?? { messages: DEFAULT_MESSAGES_TO_KEEP });

      const validatedKeep = keepSchema.parse(resolvedKeep);

      /**
       * Validate trigger conditions
       */
      let triggerConditions: ContextSize[] = [];
      if (resolvedTrigger === undefined) {
        triggerConditions = [];
      } else if (Array.isArray(resolvedTrigger)) {
        /**
         * It's an array of ContextSize objects
         */
        triggerConditions = (resolvedTrigger as ContextSize[]).map((t) =>
          contextSizeSchema.parse(t)
        );
      } else {
        /**
         * Single ContextSize object - all properties must be satisfied (AND logic)
         */
        triggerConditions = [contextSizeSchema.parse(resolvedTrigger)];
      }

      /**
       * Check if profile is required
       */
      const requiresProfile =
        triggerConditions.some((c) => "fraction" in c) ||
        "fraction" in validatedKeep;

      const model =
        typeof userOptions.model === "string"
          ? await initChatModel(userOptions.model)
          : userOptions.model;

      if (requiresProfile && !getProfileLimits(model)) {
        throw new Error(
          "Model profile information is required to use fractional token limits. " +
            "Use absolute token counts instead."
        );
      }

      const summaryPrompt =
        runtime.context?.summaryPrompt === DEFAULT_SUMMARY_PROMPT
          ? (userOptions.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT)
          : (runtime.context?.summaryPrompt ??
            userOptions.summaryPrompt ??
            DEFAULT_SUMMARY_PROMPT);
      const summaryPrefix =
        runtime.context.summaryPrefix ??
        userOptions.summaryPrefix ??
        DEFAULT_SUMMARY_PREFIX;
      const trimTokensToSummarize =
        runtime.context?.trimTokensToSummarize !== undefined
          ? runtime.context.trimTokensToSummarize
          : (userOptions.trimTokensToSummarize ?? DEFAULT_TRIM_TOKEN_LIMIT);

      /**
       * Ensure all messages have IDs
       */
      ensureMessageIds(state.messages);

      const tokenCounter =
        runtime.context?.tokenCounter !== undefined
          ? runtime.context.tokenCounter
          : (userOptions.tokenCounter ?? countTokensApproximately);
      const totalTokens = await tokenCounter(state.messages);
      const doSummarize = await shouldSummarize(
        state.messages,
        totalTokens,
        triggerConditions,
        model
      );

      if (!doSummarize) {
        return;
      }

      const { systemPrompt, conversationMessages } = splitSystemMessage(
        state.messages
      );
      const cutoffIndex = await determineCutoffIndex(
        conversationMessages,
        validatedKeep,
        tokenCounter,
        model
      );

      if (cutoffIndex <= 0) {
        return;
      }

      const { messagesToSummarize, preservedMessages } = partitionMessages(
        systemPrompt,
        conversationMessages,
        cutoffIndex
      );

      const summary = await createSummary(
        messagesToSummarize,
        model,
        summaryPrompt,
        tokenCounter,
        trimTokensToSummarize
      );

      const summaryMessage = new HumanMessage({
        content: `${summaryPrefix}\n\n${summary}`,
        id: uuid(),
        additional_kwargs: { lc_source: "summarization" },
      });

      return {
        messages: [
          new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
          summaryMessage,
          ...preservedMessages,
        ],
      };
    },
  });
}

/**
 * Ensure all messages have unique IDs
 */
function ensureMessageIds(messages: BaseMessage[]): void {
  for (const msg of messages) {
    if (!msg.id) {
      msg.id = uuid();
    }
  }
}

/**
 * Separate system message from conversation messages
 */
function splitSystemMessage(messages: BaseMessage[]): {
  systemPrompt?: SystemMessage;
  conversationMessages: BaseMessage[];
} {
  if (messages.length > 0 && SystemMessage.isInstance(messages[0])) {
    return {
      systemPrompt: messages[0] as SystemMessage,
      conversationMessages: messages.slice(1),
    };
  }
  return {
    conversationMessages: messages,
  };
}

/**
 * Partition messages into those to summarize and those to preserve
 */
function partitionMessages(
  systemPrompt: SystemMessage | undefined,
  conversationMessages: BaseMessage[],
  cutoffIndex: number
): { messagesToSummarize: BaseMessage[]; preservedMessages: BaseMessage[] } {
  const messagesToSummarize = conversationMessages.slice(0, cutoffIndex);
  const preservedMessages = conversationMessages.slice(cutoffIndex);

  // Include system message in messages to summarize to capture previous summaries
  if (systemPrompt) {
    messagesToSummarize.unshift(systemPrompt);
  }

  return { messagesToSummarize, preservedMessages };
}

/**
 * Determine whether summarization should run for the current token usage
 *
 * @param messages - Current messages in the conversation
 * @param totalTokens - Total token count for all messages
 * @param triggerConditions - Array of trigger conditions. Returns true if ANY condition is satisfied (OR logic).
 *                           Within each condition, ALL specified properties must be satisfied (AND logic).
 * @param model - The language model being used
 * @returns true if summarization should be triggered
 */
async function shouldSummarize(
  messages: BaseMessage[],
  totalTokens: number,
  triggerConditions: ContextSize[],
  model: BaseLanguageModel
): Promise<boolean> {
  if (triggerConditions.length === 0) {
    return false;
  }

  /**
   * Check each condition (OR logic between conditions)
   */
  for (const trigger of triggerConditions) {
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
      const maxInputTokens = getProfileLimits(model);
      if (typeof maxInputTokens === "number") {
        const threshold = Math.floor(maxInputTokens * trigger.fraction);
        if (totalTokens < threshold) {
          conditionMet = false;
        }
      } else {
        /**
         * If fraction is specified but we can't get model limits, skip this condition
         */
        conditionMet = false;
      }
    }

    /**
     * If condition has at least one property and all properties are satisfied, trigger summarization
     */
    if (hasAnyProperty && conditionMet) {
      return true;
    }
  }

  return false;
}

/**
 * Determine cutoff index respecting retention configuration
 */
async function determineCutoffIndex(
  messages: BaseMessage[],
  keep: ContextSize,
  tokenCounter: TokenCounter,
  model: BaseLanguageModel
): Promise<number> {
  if ("tokens" in keep || "fraction" in keep) {
    const tokenBasedCutoff = await findTokenBasedCutoff(
      messages,
      keep,
      tokenCounter,
      model
    );
    if (typeof tokenBasedCutoff === "number") {
      return tokenBasedCutoff;
    }
    /**
     * Fallback to message count if token-based fails
     */
    return findSafeCutoff(messages, DEFAULT_MESSAGES_TO_KEEP);
  }
  /**
   * find cutoff index based on message count
   */
  return findSafeCutoff(messages, keep.messages ?? DEFAULT_MESSAGES_TO_KEEP);
}

/**
 * Find cutoff index based on target token retention
 */
async function findTokenBasedCutoff(
  messages: BaseMessage[],
  keep: ContextSize,
  tokenCounter: TokenCounter,
  model: BaseLanguageModel
): Promise<number | undefined> {
  if (messages.length === 0) {
    return 0;
  }

  let targetTokenCount: number;

  if ("fraction" in keep && keep.fraction !== undefined) {
    const maxInputTokens = getProfileLimits(model);
    if (typeof maxInputTokens !== "number") {
      return;
    }
    targetTokenCount = Math.floor(maxInputTokens * keep.fraction);
  } else if ("tokens" in keep && keep.tokens !== undefined) {
    targetTokenCount = Math.floor(keep.tokens);
  } else {
    return;
  }

  if (targetTokenCount <= 0) {
    targetTokenCount = 1;
  }

  const totalTokens = await tokenCounter(messages);
  if (totalTokens <= targetTokenCount) {
    return 0;
  }

  /**
   * Use binary search to identify the earliest message index that keeps the
   * suffix within the token budget.
   */
  let left = 0;
  let right = messages.length;
  let cutoffCandidate = messages.length;
  const maxIterations = Math.floor(Math.log2(messages.length)) + 1;

  for (let i = 0; i < maxIterations; i++) {
    if (left >= right) {
      break;
    }

    const mid = Math.floor((left + right) / 2);
    const suffixTokens = await tokenCounter(messages.slice(mid));
    if (suffixTokens <= targetTokenCount) {
      cutoffCandidate = mid;
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  if (cutoffCandidate === messages.length) {
    cutoffCandidate = left;
  }

  if (cutoffCandidate >= messages.length) {
    if (messages.length === 1) {
      return 0;
    }
    cutoffCandidate = messages.length - 1;
  }

  /**
   * Find safe cutoff point that preserves AI/Tool pairs.
   * If cutoff lands on ToolMessage, move backward to include the AIMessage.
   */
  const safeCutoff = findSafeCutoffPoint(messages, cutoffCandidate);

  /**
   * If findSafeCutoffPoint moved forward (fallback case), verify it's safe.
   * If it moved backward, we already have a safe point.
   */
  if (safeCutoff <= cutoffCandidate) {
    return safeCutoff;
  }

  /**
   * Fallback: iterate backward to find a safe cutoff
   */
  for (let i = cutoffCandidate; i >= 0; i--) {
    if (isSafeCutoffPoint(messages, i)) {
      return i;
    }
  }

  return 0;
}

/**
 * Find safe cutoff point that preserves AI/Tool message pairs
 */
function findSafeCutoff(
  messages: BaseMessage[],
  messagesToKeep: number
): number {
  if (messages.length <= messagesToKeep) {
    return 0;
  }

  const targetCutoff = messages.length - messagesToKeep;

  /**
   * First, try to find a safe cutoff point using findSafeCutoffPoint.
   * This handles the case where cutoff lands on a ToolMessage by moving
   * backward to include the corresponding AIMessage.
   */
  const safeCutoff = findSafeCutoffPoint(messages, targetCutoff);

  /**
   * If findSafeCutoffPoint moved backward (found matching AIMessage), use it.
   */
  if (safeCutoff <= targetCutoff) {
    return safeCutoff;
  }

  /**
   * Fallback: iterate backward to find a safe cutoff
   */
  for (let i = targetCutoff; i >= 0; i--) {
    if (isSafeCutoffPoint(messages, i)) {
      return i;
    }
  }

  return 0;
}

/**
 * Check if cutting at index would separate AI/Tool message pairs
 */
function isSafeCutoffPoint(
  messages: BaseMessage[],
  cutoffIndex: number
): boolean {
  if (cutoffIndex >= messages.length) {
    return true;
  }

  /**
   * Prevent preserved messages from starting with AI message containing tool calls
   */
  if (
    cutoffIndex < messages.length &&
    AIMessage.isInstance(messages[cutoffIndex]) &&
    hasToolCalls(messages[cutoffIndex])
  ) {
    return false;
  }

  const searchStart = Math.max(0, cutoffIndex - SEARCH_RANGE_FOR_TOOL_PAIRS);
  const searchEnd = Math.min(
    messages.length,
    cutoffIndex + SEARCH_RANGE_FOR_TOOL_PAIRS
  );

  for (let i = searchStart; i < searchEnd; i++) {
    if (!hasToolCalls(messages[i])) {
      continue;
    }

    const toolCallIds = extractToolCallIds(messages[i] as AIMessage);
    if (cutoffSeparatesToolPair(messages, i, cutoffIndex, toolCallIds)) {
      return false;
    }
  }

  return true;
}

/**
 * Extract tool call IDs from an AI message
 */
function extractToolCallIds(aiMessage: AIMessage): Set<string> {
  const toolCallIds = new Set<string>();
  if (aiMessage.tool_calls) {
    for (const toolCall of aiMessage.tool_calls) {
      const id =
        typeof toolCall === "object" && "id" in toolCall ? toolCall.id : null;
      if (id) {
        toolCallIds.add(id);
      }
    }
  }
  return toolCallIds;
}

/**
 * Find a safe cutoff point that doesn't split AI/Tool message pairs.
 *
 * If the message at `cutoffIndex` is a `ToolMessage`, search backward for the
 * `AIMessage` containing the corresponding `tool_calls` and adjust the cutoff to
 * include it. This ensures tool call requests and responses stay together.
 *
 * Falls back to advancing forward past `ToolMessage` objects only if no matching
 * `AIMessage` is found (edge case).
 */
function findSafeCutoffPoint(
  messages: BaseMessage[],
  cutoffIndex: number
): number {
  if (
    cutoffIndex >= messages.length ||
    !ToolMessage.isInstance(messages[cutoffIndex])
  ) {
    return cutoffIndex;
  }

  // Collect tool_call_ids from consecutive ToolMessages at/after cutoff
  const toolCallIds = new Set<string>();
  let idx = cutoffIndex;
  while (idx < messages.length && ToolMessage.isInstance(messages[idx])) {
    const toolMsg = messages[idx] as ToolMessage;
    if (toolMsg.tool_call_id) {
      toolCallIds.add(toolMsg.tool_call_id);
    }
    idx++;
  }

  // Search backward for AIMessage with matching tool_calls
  for (let i = cutoffIndex - 1; i >= 0; i--) {
    const msg = messages[i];
    if (AIMessage.isInstance(msg) && hasToolCalls(msg)) {
      const aiToolCallIds = extractToolCallIds(msg as AIMessage);
      // Check if there's any overlap between the tool_call_ids
      for (const id of toolCallIds) {
        if (aiToolCallIds.has(id)) {
          // Found the AIMessage - move cutoff to include it
          return i;
        }
      }
    }
  }

  // Fallback: no matching AIMessage found, advance past ToolMessages to avoid
  // orphaned tool responses
  return idx;
}

/**
 * Check if cutoff separates an AI message from its corresponding tool messages
 */
function cutoffSeparatesToolPair(
  messages: BaseMessage[],
  aiMessageIndex: number,
  cutoffIndex: number,
  toolCallIds: Set<string>
): boolean {
  for (let j = aiMessageIndex + 1; j < messages.length; j++) {
    const message = messages[j];
    if (
      ToolMessage.isInstance(message) &&
      toolCallIds.has(message.tool_call_id)
    ) {
      const aiBeforeCutoff = aiMessageIndex < cutoffIndex;
      const toolBeforeCutoff = j < cutoffIndex;
      if (aiBeforeCutoff !== toolBeforeCutoff) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Generate summary for the given messages
 */
async function createSummary(
  messagesToSummarize: BaseMessage[],
  model: BaseLanguageModel,
  summaryPrompt: string,
  tokenCounter: TokenCounter,
  trimTokensToSummarize: number | undefined
): Promise<string> {
  if (!messagesToSummarize.length) {
    return "No previous conversation history.";
  }

  const trimmedMessages = await trimMessagesForSummary(
    messagesToSummarize,
    tokenCounter,
    trimTokensToSummarize
  );

  if (!trimmedMessages.length) {
    return "Previous conversation was too long to summarize.";
  }

  /**
   * Format messages using getBufferString to avoid token inflation from metadata
   * when str() / JSON.stringify is called on message objects.
   * This produces compact output like:
   * ```
   * Human: What's the weather?
   * AI: Let me check...[tool_calls]
   * Tool: 72°F and sunny
   * ```
   */
  const formattedMessages = getBufferString(trimmedMessages);

  try {
    const formattedPrompt = summaryPrompt.replace(
      "{messages}",
      formattedMessages
    );
    /**
     * Invoke the model with an empty callbacks array to prevent the internal
     * summarization call from being streamed to the UI. This ensures the
     * summarization is an internal housekeeping step that doesn't leak
     * assistant messages or streaming events.
     */
    const response = await model.invoke(formattedPrompt, { callbacks: [] });
    const content = response.content;
    /**
     * Handle both string content and MessageContent array
     */
    if (typeof content === "string") {
      return content.trim();
    } else if (Array.isArray(content)) {
      /**
       * Extract text from MessageContent array
       */
      const textContent = content
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "text" in item) {
            return (item as { text: string }).text;
          }
          return "";
        })
        .join("");
      return textContent.trim();
    }
    return "Error generating summary: Invalid response format";
  } catch (e) {
    return `Error generating summary: ${e}`;
  }
}

/**
 * Trim messages to fit within summary generation limits
 */
async function trimMessagesForSummary(
  messages: BaseMessage[],
  tokenCounter: TokenCounter,
  trimTokensToSummarize: number | undefined
): Promise<BaseMessage[]> {
  if (trimTokensToSummarize === undefined) {
    return messages;
  }

  try {
    return await trimMessages(messages, {
      maxTokens: trimTokensToSummarize,
      tokenCounter: async (msgs) => tokenCounter(msgs),
      strategy: "last",
      allowPartial: true,
      includeSystem: true,
    });
  } catch {
    /**
     * Fallback to last N messages if trimming fails
     */
    return messages.slice(-DEFAULT_FALLBACK_MESSAGE_COUNT);
  }
}
