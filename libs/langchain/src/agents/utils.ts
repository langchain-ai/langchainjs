import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageLike,
  SystemMessage,
  MessageContent,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import {
  LanguageModelLike,
  BaseLanguageModelInput,
} from "@langchain/core/language_models/base";
import {
  Runnable,
  RunnableLike,
  RunnableConfig,
  RunnableLambda,
  RunnableSequence,
  RunnableBinding,
} from "@langchain/core/runnables";

import { isBaseChatModel, isConfigurableModel } from "./model.js";
import type { ClientTool, ServerTool } from "./tools.js";
import { MultipleToolsBoundError } from "./errors.js";
import { PROMPT_RUNNABLE_NAME } from "./constants.js";

const NAME_PATTERN = /<name>(.*?)<\/name>/s;
const CONTENT_PATTERN = /<content>(.*?)<\/content>/s;

export type AgentNameMode = "inline";

/**
 * Attach formatted agent names to the messages passed to and from a language model.
 *
 * This is useful for making a message history with multiple agents more coherent.
 *
 * NOTE: agent name is consumed from the message.name field.
 * If you're using an agent built with createAgent, name is automatically set.
 * If you're building a custom agent, make sure to set the name on the AI message returned by the LLM.
 *
 * @param message - Message to add agent name formatting to
 * @returns Message with agent name formatting
 *
 * @internal
 */
export function _addInlineAgentName<T extends BaseMessageLike>(
  message: T
): T | AIMessage {
  if (!AIMessage.isInstance(message) || AIMessageChunk.isInstance(message)) {
    return message;
  }

  if (!message.name) {
    return message;
  }

  const { name } = message;

  if (typeof message.content === "string") {
    return new AIMessage({
      ...message.lc_kwargs,
      content: `<name>${name}</name><content>${message.content}</content>`,
      name: undefined,
    });
  }

  const updatedContent = [];
  let textBlockCount = 0;

  for (const contentBlock of message.content) {
    if (typeof contentBlock === "string") {
      textBlockCount += 1;
      updatedContent.push(
        `<name>${name}</name><content>${contentBlock}</content>`
      );
    } else if (
      typeof contentBlock === "object" &&
      "type" in contentBlock &&
      contentBlock.type === "text"
    ) {
      textBlockCount += 1;
      updatedContent.push({
        ...contentBlock,
        text: `<name>${name}</name><content>${contentBlock.text}</content>`,
      });
    } else {
      updatedContent.push(contentBlock);
    }
  }

  if (!textBlockCount) {
    updatedContent.unshift({
      type: "text",
      text: `<name>${name}</name><content></content>`,
    });
  }
  return new AIMessage({
    ...message.lc_kwargs,
    content: updatedContent as MessageContent,
    name: undefined,
  });
}

/**
 * Remove explicit name and content XML tags from the AI message content.
 *
 * Examples:
 *
 * @example
 * ```typescript
 * removeInlineAgentName(new AIMessage({ content: "<name>assistant</name><content>Hello</content>", name: "assistant" }))
 * // AIMessage with content: "Hello"
 *
 * removeInlineAgentName(new AIMessage({ content: [{type: "text", text: "<name>assistant</name><content>Hello</content>"}], name: "assistant" }))
 * // AIMessage with content: [{type: "text", text: "Hello"}]
 * ```
 *
 * @internal
 */
export function _removeInlineAgentName<T extends BaseMessage>(message: T): T {
  if (!AIMessage.isInstance(message) || !message.content) {
    return message;
  }

  let updatedContent: MessageContent = [];
  let updatedName: string | undefined;

  if (Array.isArray(message.content)) {
    updatedContent = message.content
      .filter((block) => {
        if (block.type === "text" && typeof block.text === "string") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);
          // don't include empty content blocks that were added because there was no text block to modify
          if (nameMatch && (!contentMatch || contentMatch[1] === "")) {
            // capture name from text block
            updatedName = nameMatch[1];
            return false;
          }
          return true;
        }
        return true;
      })
      .map((block) => {
        if (block.type === "text" && typeof block.text === "string") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);

          if (!nameMatch || !contentMatch) {
            return block;
          }

          // capture name from text block
          updatedName = nameMatch[1];

          return {
            ...block,
            text: contentMatch[1],
          };
        }
        return block;
      });
  } else {
    const content = message.content as string;
    const nameMatch = content.match(NAME_PATTERN);
    const contentMatch = content.match(CONTENT_PATTERN);

    if (!nameMatch || !contentMatch) {
      return message;
    }

    updatedName = nameMatch[1];
    updatedContent = contentMatch[1];
  }

  return new AIMessage({
    ...(Object.keys(message.lc_kwargs ?? {}).length > 0
      ? message.lc_kwargs
      : message),
    content: updatedContent,
    name: updatedName,
  }) as T;
}

export function isClientTool(
  tool: ClientTool | ServerTool
): tool is ClientTool {
  return Runnable.isRunnable(tool);
}

/**
 * Helper function to check if a language model has a bindTools method.
 * @param llm - The language model to check if it has a bindTools method.
 * @returns True if the language model has a bindTools method, false otherwise.
 */
function _isChatModelWithBindTools(
  llm: LanguageModelLike
): llm is BaseChatModel & Required<Pick<BaseChatModel, "bindTools">> {
  if (!isBaseChatModel(llm)) return false;
  return "bindTools" in llm && typeof llm.bindTools === "function";
}

/**
 * Helper function to bind tools to a language model.
 * @param llm - The language model to bind tools to.
 * @param toolClasses - The tools to bind to the language model.
 * @param options - The options to pass to the language model.
 * @returns The language model with the tools bound to it.
 */
const _simpleBindTools = (
  llm: LanguageModelLike,
  toolClasses: (ClientTool | ServerTool)[],
  options: Partial<BaseChatModelCallOptions> = {}
) => {
  if (_isChatModelWithBindTools(llm)) {
    return llm.bindTools(toolClasses, options);
  }

  if (
    RunnableBinding.isRunnableBinding(llm) &&
    _isChatModelWithBindTools(llm.bound)
  ) {
    const newBound = llm.bound.bindTools(toolClasses, options);

    if (RunnableBinding.isRunnableBinding(newBound)) {
      return new RunnableBinding({
        bound: newBound.bound,
        config: { ...llm.config, ...newBound.config },
        kwargs: { ...llm.kwargs, ...newBound.kwargs },
        configFactories: newBound.configFactories ?? llm.configFactories,
      });
    }

    return new RunnableBinding({
      bound: newBound,
      config: llm.config,
      kwargs: llm.kwargs,
      configFactories: llm.configFactories,
    });
  }

  return null;
};

/**
 * Check if the LLM already has bound tools and throw if it does.
 *
 * @param llm - The LLM to check.
 * @returns void
 */
export function validateLLMHasNoBoundTools(llm: LanguageModelLike): void {
  /**
   * If llm is a function, we can't validate until runtime, so skip
   */
  if (typeof llm === "function") {
    return;
  }

  let model = llm;

  /**
   * If model is a RunnableSequence, find a RunnableBinding in its steps
   */
  if (RunnableSequence.isRunnableSequence(model)) {
    model =
      model.steps.find((step: RunnableLike) =>
        RunnableBinding.isRunnableBinding(step)
      ) || model;
  }

  /**
   * If model is configurable, get the underlying model
   */
  if (isConfigurableModel(model)) {
    /**
     * Can't validate async model retrieval in constructor
     */
    return;
  }

  /**
   * Check if model is a RunnableBinding with bound tools
   */
  if (RunnableBinding.isRunnableBinding(model)) {
    const hasToolsInKwargs =
      model.kwargs != null &&
      typeof model.kwargs === "object" &&
      "tools" in model.kwargs &&
      Array.isArray(model.kwargs.tools) &&
      model.kwargs.tools.length > 0;

    const hasToolsInConfig =
      model.config != null &&
      typeof model.config === "object" &&
      "tools" in model.config &&
      Array.isArray(model.config.tools) &&
      model.config.tools.length > 0;

    if (hasToolsInKwargs || hasToolsInConfig) {
      throw new MultipleToolsBoundError();
    }
  }

  /**
   * Also check if model has tools property directly (e.g., FakeToolCallingModel)
   */
  if (
    "tools" in model &&
    model.tools !== undefined &&
    Array.isArray(model.tools) &&
    model.tools.length > 0
  ) {
    throw new MultipleToolsBoundError();
  }
}

/**
 * Check if the last message in the messages array has tool calls.
 *
 * @param messages - The messages to check.
 * @returns True if the last message has tool calls, false otherwise.
 */
export function hasToolCalls(messages: BaseMessage[]): boolean {
  const lastMessage = messages.at(-1);
  return Boolean(
    AIMessage.isInstance(lastMessage) &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
  );
}

type Prompt = string | SystemMessage;

export function getPromptRunnable(prompt?: Prompt): Runnable {
  let promptRunnable: Runnable;

  if (prompt == null) {
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => state.messages
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else if (typeof prompt === "string") {
    const systemMessage = new SystemMessage(prompt);
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => {
        return [systemMessage, ...(state.messages ?? [])];
      }
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else {
    throw new Error(`Got unexpected type for 'prompt': ${typeof prompt}`);
  }

  return promptRunnable;
}

/**
 * Helper function to bind tools to a language model.
 * @param llm - The language model to bind tools to.
 * @param toolClasses - The tools to bind to the language model.
 * @param options - The options to pass to the language model.
 * @returns The language model with the tools bound to it.
 */
export async function bindTools(
  llm: LanguageModelLike,
  toolClasses: (ClientTool | ServerTool)[],
  options: Partial<BaseChatModelCallOptions> = {}
): Promise<
  | RunnableSequence<unknown, unknown>
  | RunnableBinding<unknown, unknown, RunnableConfig<Record<string, unknown>>>
  | Runnable<BaseLanguageModelInput, AIMessageChunk, BaseChatModelCallOptions>
> {
  const model = _simpleBindTools(llm, toolClasses, options);
  if (model) return model;

  if (isConfigurableModel(llm)) {
    const model = _simpleBindTools(await llm._model(), toolClasses, options);
    if (model) return model;
  }

  if (RunnableSequence.isRunnableSequence(llm)) {
    const modelStep = llm.steps.findIndex(
      (step) =>
        RunnableBinding.isRunnableBinding(step) ||
        isBaseChatModel(step) ||
        isConfigurableModel(step)
    );

    if (modelStep >= 0) {
      const model = _simpleBindTools(
        llm.steps[modelStep],
        toolClasses,
        options
      );
      if (model) {
        const nextSteps: unknown[] = llm.steps.slice();
        nextSteps.splice(modelStep, 1, model);

        return RunnableSequence.from(
          nextSteps as [RunnableLike, ...RunnableLike[], RunnableLike]
        );
      }
    }
  }

  throw new Error(`llm ${llm} must define bindTools method.`);
}
