import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

import { initChatModel } from "../../../../chat_models/universal.js";
import { createMiddleware } from "../../../middleware.js";
import type { MiddlewareResult, AgentMiddleware } from "../../types.js";
import type { AgentBuiltInState } from "../../../runtime.js";

/**
 * OpenAI model interface.
 */
interface OpenAIModel extends BaseLanguageModel {
  getName: () => string;
  _getClientOptions: () => unknown;
  client: {
    moderations: {
      create: (
        input: {
          input: string | string[];
          model: string;
        },
        options?: unknown
      ) => Promise<ModerationResponse>;
    };
  };
}

/**
 * Check if the model is an OpenAI model that supports moderation.
 * @param model - The model to check.
 * @returns Whether the model is an OpenAI model that supports moderation.
 */
function isOpenAIModel(model: unknown): model is OpenAIModel {
  if (
    !model ||
    typeof model !== "object" ||
    model === null ||
    !("client" in model) ||
    !("_getClientOptions" in model) ||
    typeof model._getClientOptions !== "function"
  ) {
    return false;
  }

  /**
   * client may not yet be initialized, so we need to check if the model has a _getClientOptions method.
   */
  model._getClientOptions();
  return (
    typeof model.client === "object" &&
    model.client !== null &&
    "moderations" in model.client &&
    typeof model.client.moderations === "object" &&
    model.client.moderations !== null &&
    "create" in model.client.moderations &&
    typeof model.client.moderations.create === "function"
  );
}

/**
 * Stage where a violation occurred.
 */
export type ViolationStage = "input" | "output" | "tool";

/**
 * Default template for violation messages.
 */
const DEFAULT_VIOLATION_TEMPLATE =
  "I'm sorry, but I can't comply with that request. It was flagged for {categories}.";

/**
 * Result of moderation.
 * @see https://platform.openai.com/docs/api-reference/moderations/object
 */
interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
  category_applied_input_types: Record<string, string[]>;
}

/**
 * Moderation response.
 * @see https://platform.openai.com/docs/api-reference/moderations/create
 */
interface ModerationResponse {
  id: string;
  model: string;
  results: ModerationResult[];
}

type ModerationModel =
  | "omni-moderation-latest"
  | "omni-moderation-2024-09-26"
  | "text-moderation-latest"
  | "text-moderation-stable";

/**
 * Error raised when OpenAI flags content and `exitBehavior` is set to `"error"`.
 */
export class OpenAIModerationError extends Error {
  content: string;
  stage: ViolationStage;
  result: ModerationResult;
  originalMessage: string;

  constructor({
    content,
    stage,
    result,
    message,
  }: {
    content: string;
    stage: ViolationStage;
    result: ModerationResult;
    message: string;
  }) {
    super(message);
    this.name = "OpenAIModerationError";
    this.content = content;
    this.stage = stage;
    this.result = result;
    this.originalMessage = message;
  }
}

/**
 * Options for configuring the OpenAI Moderation middleware.
 */
export interface OpenAIModerationMiddlewareOptions {
  /**
   * OpenAI model to use for moderation. Can be either a model name or a BaseChatModel instance.
   * @example
   * ```ts
   * const model = new ChatOpenAI({ model: "gpt-4o-mini" });
   * const middleware = openAIModerationMiddleware({ model });
   * const agent = createAgent({
   *   model,
   *   middleware: [middleware],
   * });
   * ```
   * @example
   * ```ts
   * const middleware = openAIModerationMiddleware({ model: "gpt-4o-mini" });
   * const agent = createAgent({
   *   model: "gpt-5",
   *   middleware: [middleware],
   * });
   * ```
   */
  model: string | BaseChatModel;

  /**
   * Moderation model to use.
   * @default "omni-moderation-latest"
   */
  moderationModel?: ModerationModel;

  /**
   * Whether to check user input messages.
   * @default true
   */
  checkInput?: boolean;

  /**
   * Whether to check model output messages.
   * @default true
   */
  checkOutput?: boolean;

  /**
   * Whether to check tool result messages.
   * @default false
   */
  checkToolResults?: boolean;

  /**
   * How to handle violations.
   * - `"error"`: Throw an error when content is flagged
   * - `"end"`: End the agent execution and return a violation message
   * - `"replace"`: Replace the flagged content with a violation message
   * @default "end"
   */
  exitBehavior?: "error" | "end" | "replace";

  /**
   * Custom template for violation messages.
   * Available placeholders: `{categories}`, `{category_scores}`, `{original_content}`
   */
  violationMessage?: string;
}

/**
 * Middleware that moderates agent traffic using OpenAI's moderation endpoint.
 *
 * This middleware checks messages for content policy violations at different stages:
 * - Input: User messages before they reach the model
 * - Output: AI model responses
 * - Tool results: Results returned from tool executions
 *
 * @param options - Configuration options for the middleware
 * @param options.model - OpenAI model to use for moderation. Can be either a model name or a BaseChatModel instance.
 * @param options.moderationModel - Moderation model to use.
 * @param options.checkInput - Whether to check user input messages.
 * @param options.checkOutput - Whether to check model output messages.
 * @param options.checkToolResults - Whether to check tool result messages.
 * @param options.exitBehavior - How to handle violations.
 * @param options.violationMessage - Custom template for violation messages.
 * @returns Middleware function that can be used to moderate agent traffic.
 *
 * @example  Using model instance
 * ```ts
 * import { createAgent, openAIModerationMiddleware } from "langchain";
 *
 * const middleware = openAIModerationMiddleware({
 *   checkInput: true,
 *   checkOutput: true,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [...],
 *   middleware: [middleware],
 * });
 * ```
 *
 * @example Using model name
 * ```ts
 * import { createAgent, openAIModerationMiddleware } from "langchain";
 *
 * const middleware = openAIModerationMiddleware({
 *   model: "gpt-4o-mini",
 *   checkInput: true,
 *   checkOutput: true,
 *   exitBehavior: "end"
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [...],
 *   middleware: [middleware],
 * });
 * ```
 *
 * @example Custom violation message
 * ```ts
 * const middleware = openAIModerationMiddleware({
 *   violationMessage: "Content flagged: {categories}. Scores: {category_scores}"
 * });
 * ```
 */
export function openAIModerationMiddleware(
  options: OpenAIModerationMiddlewareOptions
): AgentMiddleware {
  const {
    model,
    moderationModel = "omni-moderation-latest",
    checkInput = true,
    checkOutput = true,
    checkToolResults = false,
    exitBehavior = "end",
    violationMessage,
  } = options;

  let openaiModel: OpenAIModel | undefined;
  const initModerationModel = async (): Promise<OpenAIModel> => {
    if (openaiModel) {
      return openaiModel;
    }

    const resolvedModel =
      typeof model === "string" ? await initChatModel(model) : model;

    /**
     * Check if the model is an OpenAI model.
     */
    if (!resolvedModel.getName().includes("ChatOpenAI")) {
      throw new Error(
        `Model must be an OpenAI model to use moderation middleware. Got: ${resolvedModel.getName()}`
      );
    }

    /**
     * check if OpenAI model package supports moderation.
     */
    if (!isOpenAIModel(resolvedModel)) {
      throw new Error(
        "Model must support moderation to use moderation middleware."
      );
    }

    openaiModel = resolvedModel as unknown as OpenAIModel;
    return openaiModel;
  };

  /**
   * Extract text content from a message.
   */
  const extractText = (message: BaseMessage): string | null => {
    if (message.content == null) {
      return null;
    }
    const text = message.text;
    return text || null;
  };

  /**
   * Find the last index of a message type in the messages array.
   */
  const findLastIndex = (
    messages: BaseMessage[],
    messageType: typeof AIMessage | typeof HumanMessage | typeof ToolMessage
  ): number | null => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      if (messageType.isInstance(messages[idx])) {
        return idx;
      }
    }
    return null;
  };

  /**
   * Format violation message from moderation result.
   */
  const formatViolationMessage = (
    content: string,
    result: ModerationResult
  ): string => {
    // Convert categories to array of flagged category names
    const categories: string[] = [];
    const categoriesObj = result.categories as unknown as Record<
      string,
      boolean
    >;
    for (const [name, flagged] of Object.entries(categoriesObj)) {
      if (flagged) {
        categories.push(name.replace(/_/g, " "));
      }
    }

    const categoryLabel =
      categories.length > 0
        ? categories.join(", ")
        : "OpenAI's safety policies";

    const template = violationMessage || DEFAULT_VIOLATION_TEMPLATE;
    const scoresJson = JSON.stringify(
      result.category_scores as unknown as Record<string, number>,
      null,
      2
    );

    try {
      return template
        .replace("{categories}", categoryLabel)
        .replace("{category_scores}", scoresJson)
        .replace("{original_content}", content);
    } catch {
      return template;
    }
  };

  function moderateContent(
    input: string | string[],
    params?: { model?: ModerationModel; options?: unknown }
  ): Promise<ModerationResponse> {
    const clientOptions = openaiModel?._getClientOptions?.();
    const moderationModel = params?.model ?? "omni-moderation-latest";
    const moderationRequest = {
      input,
      model: moderationModel,
    };
    return openaiModel!.client.moderations.create(
      moderationRequest,
      clientOptions
    );
  }

  /**
   * Apply violation handling based on exit behavior.
   */
  const applyViolation = (
    messages: BaseMessage[],
    index: number | null,
    stage: ViolationStage,
    content: string,
    result: ModerationResult
  ): MiddlewareResult<Partial<AgentBuiltInState>> | undefined => {
    const violationText = formatViolationMessage(content, result);

    if (exitBehavior === "error") {
      throw new OpenAIModerationError({
        content,
        stage,
        result,
        message: violationText,
      });
    }

    if (exitBehavior === "end") {
      return {
        jumpTo: "end",
        messages: [new AIMessage({ content: violationText })],
      };
    }

    if (index == null) {
      return undefined;
    }

    const newMessages = [...messages];
    const original = newMessages[index];
    const MessageConstructor = Object.getPrototypeOf(original).constructor;
    newMessages[index] = new MessageConstructor({
      ...original,
      content: violationText,
    });

    return { messages: newMessages };
  };

  /**
   * Moderate user input messages.
   */
  const moderateUserMessage = async (
    messages: BaseMessage[]
  ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | null> => {
    const idx = findLastIndex(messages, HumanMessage);
    if (idx == null) {
      return null;
    }

    const message = messages[idx];
    const text = extractText(message);
    if (!text) {
      return null;
    }

    await initModerationModel();
    const response = await moderateContent(text, {
      model: moderationModel,
    });

    const flaggedResult = response.results.find((result) => result.flagged);
    if (!flaggedResult) {
      return null;
    }

    return applyViolation(messages, idx, "input", text, flaggedResult);
  };

  /**
   * Moderate tool result messages.
   */
  const moderateToolMessages = async (
    messages: BaseMessage[]
  ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | null> => {
    const lastAiIdx = findLastIndex(messages, AIMessage);
    if (lastAiIdx == null) {
      return null;
    }

    const working = [...messages];
    let modified = false;

    for (let idx = lastAiIdx + 1; idx < working.length; idx++) {
      const msg = working[idx];
      if (!ToolMessage.isInstance(msg)) {
        continue;
      }

      const text = extractText(msg);
      if (!text) {
        continue;
      }

      await initModerationModel();
      const response = await moderateContent(text, {
        model: moderationModel,
      });
      const flaggedResult = response.results.find((result) => result.flagged);
      if (!flaggedResult) {
        continue;
      }

      const action = applyViolation(working, idx, "tool", text, flaggedResult);
      if (action) {
        if ("jumpTo" in action) {
          return action;
        }
        if ("messages" in action) {
          working.splice(
            0,
            working.length,
            ...(action.messages as BaseMessage[])
          );
          modified = true;
        }
      }
    }

    if (modified) {
      return { messages: working };
    }

    return null;
  };

  /**
   * Moderate model output messages.
   */
  const moderateOutput = async (
    messages: BaseMessage[]
  ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | null> => {
    const lastAiIdx = findLastIndex(messages, AIMessage);
    if (lastAiIdx == null) {
      return null;
    }

    const aiMessage = messages[lastAiIdx];
    const text = extractText(aiMessage);
    if (!text) {
      return null;
    }

    await initModerationModel();
    const response = await moderateContent(text, {
      model: moderationModel,
    });
    const flaggedResult = response.results.find((result) => result.flagged);
    if (!flaggedResult) {
      return null;
    }

    return applyViolation(messages, lastAiIdx, "output", text, flaggedResult);
  };

  /**
   * Moderate inputs (user messages and tool results) before model call.
   */
  const moderateInputs = async (
    messages: BaseMessage[]
  ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | null> => {
    const working = [...messages];
    let modified = false;

    if (checkToolResults) {
      const action = await moderateToolMessages(working);
      if (action) {
        if ("jumpTo" in action) {
          return action;
        }
        if ("messages" in action) {
          working.splice(
            0,
            working.length,
            ...(action.messages as BaseMessage[])
          );
          modified = true;
        }
      }
    }

    if (checkInput) {
      const action = await moderateUserMessage(working);
      if (action) {
        if ("jumpTo" in action) {
          return action;
        }
        if ("messages" in action) {
          working.splice(
            0,
            working.length,
            ...(action.messages as BaseMessage[])
          );
          modified = true;
        }
      }
    }

    if (modified) {
      return { messages: working };
    }

    return null;
  };

  return createMiddleware({
    name: "OpenAIModerationMiddleware",
    beforeModel: {
      hook: async (
        state
      ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | undefined> => {
        if (!checkInput && !checkToolResults) {
          return undefined;
        }

        const messages = state.messages || [];
        if (messages.length === 0) {
          return undefined;
        }

        return (await moderateInputs(messages)) ?? undefined;
      },
      canJumpTo: ["end"],
    },
    afterModel: {
      hook: async (
        state
      ): Promise<MiddlewareResult<Partial<AgentBuiltInState>> | undefined> => {
        if (!checkOutput) {
          return undefined;
        }

        const messages = state.messages || [];
        if (messages.length === 0) {
          return undefined;
        }

        return (await moderateOutput(messages)) ?? undefined;
      },
      canJumpTo: ["end"],
    },
  });
}
