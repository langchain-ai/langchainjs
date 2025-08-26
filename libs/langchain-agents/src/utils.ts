import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  MessageContent,
  SystemMessage,
  AIMessageChunk,
  isAIMessage,
  isAIMessageChunk,
  isBaseMessage,
  isBaseMessageChunk,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import {
  BaseChatModel,
  type BindToolsInput,
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

import { MultipleToolsBoundError } from "./errors.js";
import { PROMPT_RUNNABLE_NAME } from "./constants.js";
import {
  ServerTool,
  ClientTool,
  ConfigurableModelInterface,
  Prompt,
} from "./types.js";

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
  const isAI =
    isBaseMessage(message) &&
    (isAIMessage(message) ||
      (isBaseMessageChunk(message) && isAIMessageChunk(message)));

  if (!isAI || !message.name) {
    return message;
  }

  const { name } = message;

  if (typeof message.content === "string") {
    return new AIMessage({
      ...(Object.keys(message.lc_kwargs ?? {}).length > 0
        ? message.lc_kwargs
        : message),
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
  if (!isAIMessage(message) || !message.content) {
    return message;
  }

  let updatedContent: MessageContent = [];
  let updatedName: string | undefined;

  if (Array.isArray(message.content)) {
    updatedContent = message.content
      .filter((block) => {
        if (block.type === "text") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);
          // don't include empty content blocks that were added because there was no text block to modify
          if (nameMatch && (!contentMatch || contentMatch[1] === "")) {
            // capture name from text block
            // eslint-disable-next-line prefer-destructuring
            updatedName = nameMatch[1];
            return false;
          }
          return true;
        }
        return true;
      })
      .map((block) => {
        if (block.type === "text") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);

          if (!nameMatch || !contentMatch) {
            return block;
          }

          // capture name from text block
          // eslint-disable-next-line prefer-destructuring
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

    // eslint-disable-next-line prefer-destructuring
    updatedName = nameMatch[1];
    // eslint-disable-next-line prefer-destructuring
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

export function isBaseChatModel(
  model: LanguageModelLike
): model is BaseChatModel {
  return (
    "invoke" in model &&
    typeof model.invoke === "function" &&
    "_modelType" in model
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isConfigurableModel(
  model: unknown
): model is ConfigurableModelInterface {
  return (
    typeof model === "object" &&
    model != null &&
    "_queuedMethodOperations" in model &&
    "_model" in model &&
    typeof model._model === "function"
  );
}

function _isChatModelWithBindTools(
  llm: LanguageModelLike
): llm is BaseChatModel & Required<Pick<BaseChatModel, "bindTools">> {
  if (!isBaseChatModel(llm)) return false;
  return "bindTools" in llm && typeof llm.bindTools === "function";
}

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
  } else if (isBaseMessage(prompt) && prompt._getType() === "system") {
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => [prompt, ...state.messages]
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else if (typeof prompt === "function") {
    promptRunnable = RunnableLambda.from(prompt).withConfig({
      runName: PROMPT_RUNNABLE_NAME,
    });
  } else if (Runnable.isRunnable(prompt)) {
    promptRunnable = prompt;
  } else {
    throw new Error(`Got unexpected type for 'prompt': ${typeof prompt}`);
  }

  return promptRunnable;
}

export async function shouldBindTools(
  llm: LanguageModelLike,
  tools: (ClientTool | ServerTool)[]
): Promise<boolean> {
  // If model is a RunnableSequence, find a RunnableBinding or BaseChatModel in its steps
  let model = llm;
  if (RunnableSequence.isRunnableSequence(model)) {
    model =
      model.steps.find(
        (step) =>
          RunnableBinding.isRunnableBinding(step) ||
          isBaseChatModel(step) ||
          isConfigurableModel(step)
      ) || model;
  }

  if (isConfigurableModel(model)) {
    model = await model._model();
  }

  // If not a RunnableBinding, we should bind tools
  if (!RunnableBinding.isRunnableBinding(model)) {
    return true;
  }

  let boundTools = (() => {
    // check if model.kwargs contain the tools key
    if (
      model.kwargs != null &&
      typeof model.kwargs === "object" &&
      "tools" in model.kwargs &&
      Array.isArray(model.kwargs.tools)
    ) {
      return (model.kwargs.tools ?? null) as BindToolsInput[] | null;
    }

    // Some models can bind the tools via `withConfig()` instead of `bind()`
    if (
      model.config != null &&
      typeof model.config === "object" &&
      "tools" in model.config &&
      Array.isArray(model.config.tools)
    ) {
      return (model.config.tools ?? null) as BindToolsInput[] | null;
    }

    return null;
  })();

  // google-style
  if (
    boundTools != null &&
    boundTools.length === 1 &&
    "functionDeclarations" in boundTools[0]
  ) {
    boundTools = boundTools[0].functionDeclarations;
  }

  // If no tools in kwargs, we should bind tools
  if (boundTools == null) return true;

  // Check if tools count matches
  if (tools.length !== boundTools.length) {
    throw new Error(
      "Number of tools in the model.bindTools() and tools passed to createAgent must match"
    );
  }

  const toolNames = new Set<string>(
    tools.flatMap((tool) => (isClientTool(tool) ? tool.name : []))
  );

  const boundToolNames = new Set<string>();

  for (const boundTool of boundTools) {
    let boundToolName: string | undefined;

    // OpenAI-style tool
    if ("type" in boundTool && boundTool.type === "function") {
      boundToolName = boundTool.function.name;
    }
    // Anthropic or Google-style tool
    else if ("name" in boundTool) {
      boundToolName = boundTool.name;
    }
    // Bedrock-style tool
    else if ("toolSpec" in boundTool && "name" in boundTool.toolSpec) {
      boundToolName = boundTool.toolSpec.name;
    }
    // unknown tool type so we'll ignore it
    else {
      continue;
    }

    if (boundToolName) {
      boundToolNames.add(boundToolName);
    }
  }

  const missingTools = [...toolNames].filter((x) => !boundToolNames.has(x));
  if (missingTools.length > 0) {
    throw new Error(
      `Missing tools '${missingTools}' in the model.bindTools().` +
        `Tools in the model.bindTools() must match the tools passed to createAgent.`
    );
  }

  return false;
}

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

export async function bindTools(
  llm: LanguageModelLike,
  toolClasses: (ClientTool | ServerTool)[],
  options: Partial<BaseChatModelCallOptions> = {}
): Promise<
  | RunnableSequence<any, any>
  | RunnableBinding<any, any, RunnableConfig<Record<string, any>>>
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
    lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
  );
}

/**
 * Check if the model name supports structured output
 * @param modelName - The name of the model
 * @returns True if the model supports structured output, false otherwise
 */
export function hasSupportForStructuredOutput(modelName?: string): boolean {
  return (
    modelName?.startsWith("gpt-4") || modelName?.startsWith("gpt-5") || false
  );
}

/**
 * TypeScript currently doesn't support types for `AbortSignal.any`
 * @see https://github.com/microsoft/TypeScript/issues/60695
 */
declare const AbortSignal: {
  any(signals: AbortSignal[]): AbortSignal;
};

/**
 * `config` always contains a signal from LangGraphs Pregel class.
 * To ensure we acknowledge the abort signal from the user, we merge it
 * with the signal from the ToolNode.
 *
 * @param signals - The signals to merge.
 * @returns The merged signal.
 */
export function mergeAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  return AbortSignal.any(
    signals.filter(
      (maybeSignal): maybeSignal is AbortSignal =>
        maybeSignal !== null &&
        maybeSignal !== undefined &&
        typeof maybeSignal === "object" &&
        "aborted" in maybeSignal &&
        typeof maybeSignal.aborted === "boolean"
    )
  );
}

const CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT = [
  "ChatOpenAI",
  "FakeToolCallingModel",
];

/**
 * Identifies the models that support JSON schema output
 * @param model - The model to check
 * @returns True if the model supports JSON schema output, false otherwise
 */
export function hasSupportForJsonSchemaOutput(
  model: LanguageModelLike
): boolean {
  if (!isBaseChatModel(model)) {
    return false;
  }

  const chatModelClass = model.getName();
  if (
    CHAT_MODELS_THAT_SUPPORT_JSON_SCHEMA_OUTPUT.includes(chatModelClass) &&
    ((chatModelClass === "ChatOpenAI" &&
      /**
       * OpenAI models
       */
      "model" in model &&
      typeof model.model === "string" &&
      model.model.startsWith("gpt-4")) ||
      /**
       * for testing purposes only
       */
      (chatModelClass === "FakeToolCallingModel" &&
        "structuredResponse" in model))
  ) {
    return true;
  }

  return false;
}
