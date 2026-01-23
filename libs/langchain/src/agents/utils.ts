import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageLike,
  SystemMessage,
  MessageContent,
  ToolMessage,
} from "@langchain/core/messages";
import { isCommand } from "@langchain/langgraph";
import {
  type InteropZodObject,
  interopParse,
} from "@langchain/core/utils/types";
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
  RunnableSequence,
  RunnableBinding,
} from "@langchain/core/runnables";
import type { ClientTool, ServerTool } from "@langchain/core/tools";

import { isBaseChatModel, isConfigurableModel } from "./model.js";
import { MultipleToolsBoundError, MiddlewareError } from "./errors.js";
import type { AgentBuiltInState } from "./runtime.js";
import type {
  ToolCallHandler,
  AgentMiddleware,
  ToolCallRequest,
  WrapToolCallHook,
} from "./middleware/types.js";

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
export function hasToolCalls(message?: BaseMessage): boolean {
  return Boolean(
    AIMessage.isInstance(message) &&
      message.tool_calls &&
      message.tool_calls.length > 0
  );
}

/**
 * Normalizes a system prompt to a SystemMessage object.
 * If it's already a SystemMessage, returns it as-is.
 * If it's a string, converts it to a SystemMessage.
 * If it's undefined, creates an empty system message so it is easier to append to it later.
 */
export function normalizeSystemPrompt(
  systemPrompt?: string | SystemMessage
): SystemMessage {
  if (systemPrompt == null) {
    return new SystemMessage("");
  }
  if (SystemMessage.isInstance(systemPrompt)) {
    return systemPrompt;
  }
  if (typeof systemPrompt === "string") {
    return new SystemMessage({
      content: [{ type: "text", text: systemPrompt }],
    });
  }
  throw new Error(
    `Invalid systemPrompt type: expected string or SystemMessage, got ${typeof systemPrompt}`
  );
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
    const model = _simpleBindTools(
      await llm._getModelInstance(),
      toolClasses,
      options
    );
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
 * Compose multiple wrapToolCall handlers into a single middleware stack.
 *
 * Composes handlers so the first in the list becomes the outermost layer.
 * Each handler receives a handler callback to execute inner layers.
 *
 * @param handlers - List of handlers. First handler wraps all others.
 * @returns Composed handler, or undefined if handlers array is empty.
 *
 * @example
 * ```typescript
 * // handlers=[auth, retry] means: auth wraps retry
 * // Flow: auth calls retry, retry calls base handler
 * const auth: ToolCallWrapper = async (request, handler) => {
 *   try {
 *     return await handler(request);
 *   } catch (error) {
 *     if (error.message === "Unauthorized") {
 *       await refreshToken();
 *       return await handler(request);
 *     }
 *     throw error;
 *   }
 * };
 *
 * const retry: ToolCallWrapper = async (request, handler) => {
 *   for (let attempt = 0; attempt < 3; attempt++) {
 *     try {
 *       return await handler(request);
 *     } catch (error) {
 *       if (attempt === 2) throw error;
 *     }
 *   }
 *   throw new Error("Unreachable");
 * };
 *
 * const composedHandler = chainToolCallHandlers([auth, retry]);
 * ```
 */
function chainToolCallHandlers(
  handlers: WrapToolCallHook[]
): WrapToolCallHook | undefined {
  if (handlers.length === 0) {
    return undefined;
  }

  if (handlers.length === 1) {
    return handlers[0];
  }

  // Compose two handlers where outer wraps inner
  // The key is to properly propagate request modifications through the chain
  function composeTwo(
    outer: WrapToolCallHook,
    inner: WrapToolCallHook
  ): WrapToolCallHook {
    return async (request, handler) => {
      // Create a wrapper that calls inner with the base handler
      // The innerHandler receives the (possibly modified) request from outer
      // and passes it to inner, which then calls the base handler
      const innerHandler: ToolCallHandler = async (passedRequest) => {
        // inner receives the request passed by outer (which may be modified)
        return inner(passedRequest, handler);
      };

      // Call outer with the wrapped inner as its handler
      return outer(request, innerHandler);
    };
  }

  // Compose right-to-left: outer(inner(innermost(handler)))
  let result = handlers[handlers.length - 1];
  for (let i = handlers.length - 2; i >= 0; i--) {
    result = composeTwo(handlers[i], result);
  }

  return result;
}

/**
 * Wrapping `wrapToolCall` invocation so we can inject middleware name into
 * the error message.
 *
 * @param middleware list of middleware passed to the agent
 * @param state state of the agent
 * @returns single wrap function
 */
export function wrapToolCall(
  middleware: readonly AgentMiddleware<InteropZodObject | undefined>[]
) {
  const middlewareWithWrapToolCall = middleware.filter((m) => m.wrapToolCall);

  if (middlewareWithWrapToolCall.length === 0) {
    return;
  }

  return chainToolCallHandlers(
    middlewareWithWrapToolCall.map((m) => {
      const originalHandler = m.wrapToolCall!;
      /**
       * Wrap with error handling and validation
       */
      const wrappedHandler: WrapToolCallHook = async (request, handler) => {
        /**
         * Capture the original state for this middleware's schema parsing.
         * This is important because the request may be modified (via override)
         * as it passes through the middleware chain, but each middleware
         * should always see the full original state for its schema parsing.
         */
        const originalState = request.state;

        /**
         * Create a handler that preserves state parsing for this middleware
         * while allowing tool/toolCall/state modifications from inner middleware
         */
        const wrappedInnerHandler: ToolCallHandler = async (passedRequest) => {
          /**
           * Merge the passed request with the original state for parsing.
           * This ensures middleware can override tool/toolCall while
           * maintaining proper state parsing for each middleware in the chain.
           */
          const mergedState = {
            ...originalState,
            ...passedRequest.state,
          };
          return handler({
            ...passedRequest,
            state: mergedState,
          });
        };

        try {
          const result = await originalHandler(
            {
              ...request,
              /**
               * override state with the state from the specific middleware
               */
              state: {
                messages: originalState.messages,
                ...(m.stateSchema
                  ? interopParse(m.stateSchema, { ...originalState })
                  : {}),
              },
            } as ToolCallRequest<AgentBuiltInState, unknown>,
            wrappedInnerHandler
          );

          /**
           * Validate return type
           */
          if (!ToolMessage.isInstance(result) && !isCommand(result)) {
            throw new Error(
              `Invalid response from "wrapToolCall" in middleware "${m.name}": ` +
                `expected ToolMessage or Command, got ${typeof result}`
            );
          }

          return result;
        } catch (error) {
          throw MiddlewareError.wrap(error, m.name);
        }
      };
      return wrappedHandler;
    })
  );
}
