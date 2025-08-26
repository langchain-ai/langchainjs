import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import {
  BaseMessage,
  AIMessage,
  isAIMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  InteropZodObject,
  getSchemaDescription,
} from "@langchain/core/utils/types";
import type { ToolCall } from "@langchain/core/messages/tool";

import { MultipleStructuredOutputsError } from "../errors.js";
import { RunnableCallable } from "../RunnableCallable.js";
import { PreHookAnnotation } from "../annotation.js";
import {
  bindTools,
  getPromptRunnable,
  validateLLMHasNoBoundTools,
  hasToolCalls,
  mergeAbortSignals,
  hasSupportForJsonSchemaOutput,
} from "../utils.js";
import {
  InternalAgentState,
  ClientTool,
  ServerTool,
  AnyAnnotationRoot,
  CreateReactAgentParams,
  PredicateFunction,
  ExecutedToolCall,
  LLMCall,
  PreparedCall,
} from "../types.js";
import { withAgentName } from "../withAgentName.js";
import {
  ToolOutput,
  NativeOutput,
  transformResponseFormat,
  ToolOutputError,
} from "../responses.js";

type ResponseHandlerResult<StructuredResponseFormat> =
  | {
      structuredResponse: StructuredResponseFormat;
      message: AIMessage;
    }
  | Promise<Command>;

interface AgentNodeOptions<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends Pick<
    CreateReactAgentParams<
      StateSchema,
      StructuredResponseFormat,
      ContextSchema
    >,
    | "llm"
    | "prompt"
    | "prepareCall"
    | "includeAgentName"
    | "name"
    | "stopWhen"
    | "responseFormat"
  > {
  toolClasses: (ClientTool | ServerTool)[];
  shouldReturnDirect: Set<string>;
  signal?: AbortSignal;
}

export class AgentNode<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends RunnableCallable<
  InternalAgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  { messages: BaseMessage[] } | { structuredResponse: StructuredResponseFormat }
> {
  #options: AgentNodeOptions<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema
  >;

  #stopWhen: PredicateFunction<StructuredResponseFormat>[];

  #structuredToolInfo: Record<string, ToolOutput> = {};

  constructor(
    options: AgentNodeOptions<
      StateSchema,
      StructuredResponseFormat,
      ContextSchema
    >
  ) {
    super({
      name: options.name ?? "model",
      func: (input, config) =>
        this.#run(input, config as RunnableConfig) as any,
    });

    this.#options = options;
    this.#stopWhen = options.stopWhen
      ? Array.isArray(options.stopWhen)
        ? options.stopWhen
        : [options.stopWhen]
      : [];

    /**
     * Populate a list of structured tool info.
     */
    this.#structuredToolInfo = (
      transformResponseFormat(this.#options.responseFormat).filter(
        (format) => format instanceof ToolOutput
      ) as ToolOutput[]
    ).reduce((acc, format) => {
      acc[format.name] = format;
      return acc;
    }, {} as Record<string, ToolOutput>);
  }

  async #run(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: RunnableConfig
  ) {
    /**
     * Check if we just executed a returnDirect tool
     * If so, we should generate structured response (if needed) and stop
     */
    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage instanceof ToolMessage &&
      lastMessage.name &&
      this.#options.shouldReturnDirect.has(lastMessage.name)
    ) {
      /**
       * return directly without invoking the model again
       */
      return { messages: [] };
    }

    /**
     * Check if we should stop the agent:
     * - If the agent has any tool calls
     * - if any of the provided predicate functions return true
     */
    const hasToolCalls = state.messages.some(
      (message) =>
        isAIMessage(message) &&
        message.tool_calls &&
        message.tool_calls?.length > 0
    );
    const stopWhenResults = hasToolCalls
      ? await Promise.all(
          this.#stopWhen.map((stopWhen) => stopWhen(state, config))
        )
      : [];
    const shouldStop = stopWhenResults.filter((result) => result.shouldStop);
    if (shouldStop.length > 0) {
      const shouldStopReasoning =
        shouldStop.length === 1
          ? `A stop condition was met: ${shouldStop[0].description}`
          : `Multiple stop conditions were met: ${shouldStop
              .map((result) => result.description)
              .join(", ")}`;

      /**
       * if a `responseFormat` is provided, we need to invoke the model to
       * attempt to generate a structured response
       */
      if (this.#options.responseFormat) {
        state.messages.push(new AIMessage(shouldStopReasoning));
        const response = await this.#invokeModel(state, config, {
          lastMessage: shouldStopReasoning,
        });
        if ("structuredResponse" in response) {
          return response;
        }
        return { messages: [response] };
      }

      return { messages: [shouldStopReasoning] };
    }

    const response:
      | AIMessage
      | Command
      | { structuredResponse: StructuredResponseFormat } =
      await this.#invokeModel(state, config);

    /**
     * if we were able to generate a structured response, return it
     */
    if ("structuredResponse" in response) {
      return response;
    }

    /**
     * if we need to direct the agent to the model, return the update
     */
    if (response instanceof Command) {
      return response;
    }

    response.name = this.name;
    response.lc_kwargs.name = this.name;

    if (this.#areMoreStepsNeeded(state, response)) {
      return {
        messages: [
          new AIMessage("Sorry, need more steps to process this request.", {
            name: this.name,
            lc_kwargs: { name: this.name },
            id: response.id,
          }),
        ],
      };
    }

    return { messages: [response] };
  }

  #extractToolCalls(messages: BaseMessage[]): ExecutedToolCall[] {
    const toolCalls: ExecutedToolCall[] = [];

    // Track which tool calls we've seen results for
    const toolCallResults: Record<string, unknown> = {};

    // First pass: collect tool results
    messages.forEach((message) => {
      if (message instanceof ToolMessage && message.tool_call_id) {
        toolCallResults[message.tool_call_id] = message.content;
      }
    });

    // Second pass: extract tool calls with their results
    messages
      .filter(
        (message): message is AIMessage =>
          isAIMessage(message) && Boolean(message.tool_calls)
      )
      .forEach((message) => {
        message.tool_calls?.forEach((toolCall) => {
          if (toolCall.id) {
            toolCalls.push({
              name: toolCall.name,
              args: toolCall.args,
              tool_id: toolCall.id,
              result: toolCallResults[toolCall.id],
            });
          }
        });
      });

    return toolCalls;
  }

  #extractLLMCalls(messages: BaseMessage[]): LLMCall[] {
    const llmCalls: LLMCall[] = [];
    let currentMessages: BaseMessage[] = [];

    for (const message of messages) {
      if (isAIMessage(message)) {
        // Found an AI message, create LLM call with preceding messages
        llmCalls.push({
          messages: [...currentMessages],
          response: message,
        });
        currentMessages = [];
      } else {
        currentMessages.push(message);
      }
    }

    // If there are remaining messages, create LLM call without response
    if (currentMessages.length > 0) {
      llmCalls.push({
        messages: currentMessages,
      });
    }

    return llmCalls;
  }

  #calculateStepNumber(messages: BaseMessage[]): number {
    return messages.filter(isAIMessage).length;
  }

  async #invokeModel(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: RunnableConfig,
    options: {
      lastMessage?: string;
    } = {}
  ): Promise<
    | AIMessage
    | Command
    | { structuredResponse: StructuredResponseFormat; messages?: BaseMessage[] }
  > {
    let model = this.#options.llm;
    let preparedCall: PreparedCall = {};

    /**
     * If the model is a function, call it to get the model.
     * @deprecated likely to be removed in the next version of the agent
     */
    if (typeof model === "function") {
      model = await model(state, config);
    }

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    validateLLMHasNoBoundTools(model);

    /**
     * Call prepareCall hook if provided
     */
    if (this.#options.prepareCall) {
      const stepNumber = this.#calculateStepNumber(state.messages);
      const toolCalls = this.#extractToolCalls(state.messages);
      const llmCalls = this.#extractLLMCalls(state.messages);

      preparedCall = await this.#options.prepareCall(
        {
          stepNumber,
          toolCalls,
          llmCalls,
          model,
          messages: state.messages,
          state,
        },
        config
      );

      /**
       * Apply model override if provided
       */
      if (preparedCall.model) {
        model = preparedCall.model;
        validateLLMHasNoBoundTools(model);
      }
    }

    const toolChoiceOverride = preparedCall.toolChoice
      ? { tool_choice: preparedCall.toolChoice }
      : {};

    const modelWithTools = await this.#bindTools(
      model,
      toolChoiceOverride,
      preparedCall.tools
    );

    /**
     * Apply message overrides
     */
    let modelInput = preparedCall.messages
      ? { ...state, messages: preparedCall.messages }
      : this.#getModelInputState(state);

    /**
     * Apply system message override if provided
     */
    if (preparedCall.systemMessage) {
      const { messages, ...rest } = modelInput;
      const systemMessage = new SystemMessage(preparedCall.systemMessage);
      modelInput = {
        messages: [
          systemMessage,
          ...messages.filter((m) => m.getType() !== "system"),
        ],
        ...rest,
      } as Omit<
        InternalAgentState<StructuredResponseFormat>,
        "llmInputMessages"
      >;
    }

    const signal = mergeAbortSignals(this.#options.signal, config.signal);
    const invokeConfig = {
      ...config,
      signal,
    };

    const response = (await modelWithTools.invoke(
      modelInput,
      invokeConfig
    )) as AIMessage;

    /**
     * if the user requests a native schema output, try to parse the response
     * and return the structured response if it is valid
     */
    if (this.#options.responseFormat instanceof NativeOutput) {
      const structuredResponse = this.#options.responseFormat.parse(response);
      if (structuredResponse) {
        return { structuredResponse, messages: [response] };
      }
    }

    if (!response.tool_calls) {
      return response;
    }

    const toolCalls = response.tool_calls.filter(
      (call) => call.name in this.#structuredToolInfo
    );

    /**
     * if there were not structured tool calls, we can return the response
     */
    if (toolCalls.length === 0) {
      return response;
    }

    /**
     * if there were multiple structured tool calls, we should throw an error as this
     * scenario is not defined/supported.
     */
    if (toolCalls.length > 1) {
      return this.#handleMultipleStructuredOutputs(response, toolCalls);
    }

    return this.#handleSingleStructuredOutput(
      response,
      toolCalls[0],
      options.lastMessage
    );
  }

  /**
   * If the model returns multiple structured outputs, we need to handle it.
   * @param response - The response from the model
   * @param toolCalls - The tool calls that were made
   * @returns The response from the model
   */
  #handleMultipleStructuredOutputs(
    response: AIMessage,
    toolCalls: ToolCall[]
  ): Promise<Command> {
    /**
     * the following should never happen, let's throw an error if it does
     */
    if (this.#options.responseFormat instanceof NativeOutput) {
      throw new Error(
        "Multiple structured outputs should not apply to native structured output responses"
      );
    }

    const multipleStructuredOutputsError = new MultipleStructuredOutputsError(
      toolCalls.map((call) => call.name)
    );

    return this.#handleToolOutputError(
      multipleStructuredOutputsError,
      response,
      toolCalls[0]
    );
  }

  /**
   * If the model returns a single structured output, we need to handle it.
   * @param toolCall - The tool call that was made
   * @returns The structured response and a message to the LLM if needed
   */
  #handleSingleStructuredOutput(
    response: AIMessage,
    toolCall: ToolCall,
    lastMessage?: string
  ): ResponseHandlerResult<StructuredResponseFormat> {
    const tool = this.#structuredToolInfo[toolCall.name];

    try {
      const structuredResponse = tool.parse(
        toolCall.args
      ) as StructuredResponseFormat;

      return {
        structuredResponse,
        message: new AIMessage(
          lastMessage ??
            `Returning structured response: ${JSON.stringify(
              structuredResponse
            )}`
        ),
      };
    } catch (error) {
      return this.#handleToolOutputError(
        error as ToolOutputError,
        response,
        toolCall
      );
    }
  }

  async #handleToolOutputError(
    error: ToolOutputError,
    response: AIMessage,
    toolCall: ToolCall
  ): Promise<Command> {
    /**
     * Using the `errorHandler` option of the first `ToolOutput` entry is sufficient here.
     * There is technically only one `ToolOutput` entry in `structuredToolInfo` if the user
     * uses `toolOutput` to define the response format. If the user applies a list of json
     * schema objects, these will be transformed into multiple `ToolOutput` entries but all
     * with the same `handleError` option.
     */
    const errorHandler = Object.values(this.#structuredToolInfo).at(0)?.options
      ?.handleError;

    const toolCallId = toolCall.id;
    if (!toolCallId) {
      throw new Error(
        "Tool call ID is required to handle tool output errors. Please provide a tool call ID."
      );
    }

    /**
     * retry if:
     */
    if (
      /**
       * if the user has provided `true` as the `errorHandler` option, return a new AIMessage
       * with the error message and retry the tool call.
       */
      (typeof errorHandler === "boolean" && errorHandler) ||
      /**
       * if `errorHandler` is an array and contains MultipleStructuredOutputsError
       */
      (Array.isArray(errorHandler) &&
        errorHandler.some((h) => h instanceof MultipleStructuredOutputsError))
    ) {
      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content: error.message,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model",
      });
    }

    /**
     * if `errorHandler` is a string, retry the tool call with given string
     */
    if (typeof errorHandler === "string") {
      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content: errorHandler,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model",
      });
    }

    /**
     * if `errorHandler` is a function, retry the tool call with the function
     */
    if (typeof errorHandler === "function") {
      const content = await errorHandler(error);
      if (typeof content !== "string") {
        throw new Error("Error handler must return a string.");
      }

      return new Command({
        update: {
          messages: [
            response,
            new ToolMessage({
              content,
              tool_call_id: toolCallId,
            }),
          ],
        },
        goto: "model",
      });
    }

    /**
     * throw otherwise, e.g. if `errorHandler` is not defined or set to `false`
     */
    throw error;
  }

  #areMoreStepsNeeded(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    response: BaseMessage
  ): boolean {
    const allToolsReturnDirect =
      response instanceof AIMessage &&
      response.tool_calls?.every((call) =>
        this.#options.shouldReturnDirect.has(call.name)
      );
    const remainingSteps =
      "remainingSteps" in state ? (state.remainingSteps as number) : undefined;
    return Boolean(
      remainingSteps &&
        ((remainingSteps < 1 && allToolsReturnDirect) ||
          (remainingSteps < 2 && hasToolCalls(state.messages)))
    );
  }

  #getModelInputState(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"]
  ): Omit<InternalAgentState<StructuredResponseFormat>, "llmInputMessages"> {
    const { messages, llmInputMessages, ...rest } = state;
    if (llmInputMessages && llmInputMessages.length > 0) {
      return { messages: llmInputMessages, ...rest } as Omit<
        InternalAgentState<StructuredResponseFormat>,
        "llmInputMessages"
      >;
    }
    return { messages, ...rest } as Omit<
      InternalAgentState<StructuredResponseFormat>,
      "llmInputMessages"
    >;
  }

  async #bindTools(
    model: LanguageModelLike,
    bindOptions?: Partial<BaseChatModelCallOptions>,
    toolsOverride?: (string | ClientTool | ServerTool)[]
  ): Promise<Runnable> {
    const options: Partial<BaseChatModelCallOptions> = {};
    const structuredTools = Object.values(this.#structuredToolInfo);

    let allTools = this.#options.toolClasses.concat(
      ...structuredTools.map((toolOutput) => toolOutput.tool)
    );

    /**
     * Apply tools override if provided
     */
    if (toolsOverride) {
      if (toolsOverride.length === 0) {
        throw new Error(
          "No tools were provided to override. Please provide at least one tool."
        );
      }

      /**
       * Find out if user has provided tool names that are not in the toolClasses
       */
      const hasUnknownToolStrings = toolsOverride
        .filter((tool) => typeof tool === "string")
        .filter((tool) =>
          this.#options.toolClasses.some((t) => "name" in t && t.name === tool)
        );
      if (hasUnknownToolStrings) {
        const availableToolNames =
          this.#options.toolClasses.length > 0
            ? this.#options.toolClasses.map((t) => t.name).join(", ")
            : "none";
        throw new Error(
          `Unknown tool names were used to override tools: ${toolsOverride.join(
            ", "
          )}, available tools: ${availableToolNames}`
        );
      }

      /**
       * Map tool names to tool instances
       */
      allTools = toolsOverride.map((tool) => {
        if (typeof tool === "string") {
          // Find tool by name
          return (
            this.#options.toolClasses.find(
              (t) => "name" in t && t.name === tool
            ) || tool
          );
        }
        return tool;
      }) as (ClientTool | ServerTool)[];
    }

    /**
     * If there are structured tools, we need to set the tool choice to "any"
     * so that the model can choose to use a structured tool or not.
     */
    const toolChoice = structuredTools.length > 0 ? "any" : undefined;

    /**
     * check if the user requests a native schema output
     */
    if (this.#options.responseFormat instanceof NativeOutput) {
      /**
       * if the model does not support JSON schema output, throw an error
       */
      if (!hasSupportForJsonSchemaOutput(model)) {
        throw new Error(
          "Model does not support native structured output responses. Please use a model that supports native structured output responses or use a tool output."
        );
      }

      const jsonSchemaParams = {
        name: this.#options.responseFormat.schema?.name ?? "extract",
        description: getSchemaDescription(this.#options.responseFormat.schema),
        schema: this.#options.responseFormat.schema,
        strict: true,
      };

      Object.assign(options, {
        response_format: {
          type: "json_schema",
          json_schema: jsonSchemaParams,
        },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: this.#options.responseFormat.schema,
        },
        strict: true,
      });
    }

    /**
     * Bind tools to the model if they are not already bound.
     */
    const modelWithTools = await bindTools(model, allTools, {
      ...options,
      tool_choice: toolChoice,
      ...bindOptions,
    });

    /**
     * Create a model runnable with the prompt and agent name
     */
    const modelRunnable = getPromptRunnable(this.#options.prompt).pipe(
      this.#options.includeAgentName === "inline"
        ? withAgentName(modelWithTools, this.#options.includeAgentName)
        : modelWithTools
    );

    return modelRunnable;
  }
}
