/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import {
  BaseMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod/v3";
import { Command, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  InteropZodObject,
  getSchemaDescription,
} from "@langchain/core/utils/types";
import type { ToolCall } from "@langchain/core/messages/tool";

import { initChatModel } from "../../../chat_models/universal.js";
import { MultipleStructuredOutputsError } from "../../errors.js";
import { RunnableCallable } from "../../RunnableCallable.js";
import { PreHookAnnotation, AnyAnnotationRoot } from "../../annotation.js";
import {
  bindTools,
  getPromptRunnable,
  validateLLMHasNoBoundTools,
  hasToolCalls,
  hasSupportForJsonSchemaOutput,
} from "../../utils.js";
import { mergeAbortSignals } from "../../nodes/utils.js";
import {
  ModelRequest,
  CreateAgentParams,
  InternalAgentState,
  Runtime,
  AgentMiddleware,
} from "../types.js";
import type { ClientTool, ServerTool } from "../../types.js";
import { withAgentName } from "../../withAgentName.js";
import {
  ToolStrategy,
  ProviderStrategy,
  transformResponseFormat,
  ToolStrategyError,
} from "../../responses.js";
import { parseToolCalls, parseToolResults } from "./utils.js";

type ResponseHandlerResult<StructuredResponseFormat> =
  | {
      structuredResponse: StructuredResponseFormat;
      messages: BaseMessage[];
    }
  | Promise<Command>;

export interface AgentNodeOptions<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends Pick<
    CreateAgentParams<StructuredResponseFormat, ContextSchema>,
    | "llm"
    | "model"
    | "prompt"
    | "includeAgentName"
    | "name"
    | "responseFormat"
    | "middleware"
  > {
  toolClasses: (ClientTool | ServerTool)[];
  shouldReturnDirect: Set<string>;
  signal?: AbortSignal;
  prepareModelRequestHookMiddleware?: [
    AgentMiddleware<any, any, any>,
    () => any
  ][];
}

export class AgentNode<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends RunnableCallable<
  InternalAgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  { messages: BaseMessage[] } | { structuredResponse: StructuredResponseFormat }
> {
  #options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>;

  #structuredToolInfo: Record<string, ToolStrategy> = {};

  constructor(
    options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>
  ) {
    super({
      name: options.name ?? "model",
      func: (input, config) =>
        this.#run(input, config as RunnableConfig) as any,
    });

    this.#options = options;

    /**
     * Populate a list of structured tool info.
     */
    this.#structuredToolInfo = (
      transformResponseFormat(this.#options.responseFormat).filter(
        (format) => format instanceof ToolStrategy
      ) as ToolStrategy[]
    ).reduce((acc, format) => {
      acc[format.name] = format;
      return acc;
    }, {} as Record<string, ToolStrategy>);
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
    const lastMessage = state.messages.at(-1);
    if (
      lastMessage &&
      ToolMessage.isInstance(lastMessage) &&
      lastMessage.name &&
      this.#options.shouldReturnDirect.has(lastMessage.name)
    ) {
      /**
       * return directly without invoking the model again
       */
      return { messages: [] };
    }

    const response = await this.#invokeModel(state, config);

    /**
     * if we were able to generate a structured response, return it
     */
    if ("structuredResponse" in response) {
      return {
        messages: [...state.messages, ...(response.messages || [])],
        structuredResponse: response.structuredResponse,
      };
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
          new AIMessage({
            content: "Sorry, need more steps to process this request.",
            name: this.name,
            id: response.id,
          }),
        ],
      };
    }

    return { messages: [response] };
  }

  /**
   * Derive the model from the options.
   * @param state - The state of the agent.
   * @param config - The config of the agent.
   * @returns The model.
   */
  #deriveModel(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: RunnableConfig
  ) {
    if (this.#options.model) {
      if (typeof this.#options.model === "string") {
        return initChatModel(this.#options.model);
      }

      throw new Error("`model` option must be a string.");
    }

    const model = this.#options.llm;

    /**
     * If the model is a function, call it to get the model.
     */
    if (typeof model === "function") {
      return model(state, config);
    }

    if (model) {
      return model;
    }

    throw new Error(
      "No model option was provided, either via `model` or via `llm` option."
    );
  }

  async #invokeModel(
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: RunnableConfig,
    options: {
      lastMessage?: string;
    } = {}
  ): Promise<AIMessage | ResponseHandlerResult<StructuredResponseFormat>> {
    const model = await this.#deriveModel(state, config);

    /**
     * Execute prepareModelRequest hooks from beforeModelNodes
     */
    const preparedOptions = await this.#executePrepareModelRequestHooks(
      model,
      state,
      config
    );

    /**
     * If user provides a model in the preparedOptions, use it,
     * otherwise use the model from the options
     */
    const finalModel = preparedOptions?.model ?? model;

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    validateLLMHasNoBoundTools(finalModel);

    const modelWithTools = await this.#bindTools(finalModel, preparedOptions);
    let modelInput = this.#getModelInputState(state);

    // Use messages from preparedOptions if provided
    if (preparedOptions?.messages) {
      modelInput = { ...modelInput, messages: preparedOptions.messages };
    }

    const signal = mergeAbortSignals(this.#options.signal, config.signal);
    const invokeConfig = {
      ...config,
      ...(preparedOptions?.modelSettings || {}),
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
    if (this.#options.responseFormat instanceof ProviderStrategy) {
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

    const toolStrategy = this.#structuredToolInfo[toolCalls[0].name];
    const toolMessageContent = toolStrategy?.options?.toolMessageContent;
    return this.#handleSingleStructuredOutput(
      response,
      toolCalls[0],
      toolMessageContent ?? options.lastMessage
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
    if (this.#options.responseFormat instanceof ProviderStrategy) {
      throw new Error(
        "Multiple structured outputs should not apply to native structured output responses"
      );
    }

    const multipleStructuredOutputsError = new MultipleStructuredOutputsError(
      toolCalls.map((call) => call.name)
    );

    return this.#handleToolStrategyError(
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
        messages: [
          response,
          new AIMessage(
            lastMessage ??
              `Returning structured response: ${JSON.stringify(
                structuredResponse
              )}`
          ),
        ],
      };
    } catch (error) {
      return this.#handleToolStrategyError(
        error as ToolStrategyError,
        response,
        toolCall
      );
    }
  }

  async #handleToolStrategyError(
    error: ToolStrategyError,
    response: AIMessage,
    toolCall: ToolCall
  ): Promise<Command> {
    /**
     * Using the `errorHandler` option of the first `ToolStrategy` entry is sufficient here.
     * There is technically only one `ToolStrategy` entry in `structuredToolInfo` if the user
     * uses `toolStrategy` to define the response format. If the user applies a list of json
     * schema objects, these will be transformed into multiple `ToolStrategy` entries but all
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
      AIMessage.isInstance(response) &&
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

  async #executePrepareModelRequestHooks(
    model: LanguageModelLike,
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: LangGraphRunnableConfig
  ): Promise<ModelRequest | undefined> {
    if (
      !this.#options.prepareModelRequestHookMiddleware ||
      this.#options.prepareModelRequestHookMiddleware.length === 0
    ) {
      return undefined;
    }

    // Get the prompt for system message
    let systemMessage: BaseMessage | undefined;
    if (typeof this.#options.prompt === "string") {
      systemMessage = new SystemMessage(this.#options.prompt);
    } else if (BaseMessage.isInstance(this.#options.prompt)) {
      systemMessage = this.#options.prompt;
    }

    // Prepare the initial call options
    let currentOptions: ModelRequest = {
      model,
      systemMessage,
      messages: state.messages,
      tools: [],
    };

    // Execute prepareModelRequest hooks from all middleware
    const middlewareList = this.#options.prepareModelRequestHookMiddleware;
    for (const [middleware, getMiddlewareState] of middlewareList) {
      // Merge context with default context of middleware
      const context = {
        ...(middleware.contextSchema?.parse({}) || {}),
        ...(config?.context || {}),
      };

      // Create runtime
      const runtime: Runtime<any> = {
        toolCalls: parseToolCalls(state.messages),
        toolResults: parseToolResults(state.messages),
        context,
      };

      const result = await middleware.prepareModelRequest!(
        currentOptions,
        {
          messages: state.messages,
          ...getMiddlewareState(),
        },
        {
          ...runtime,
          context,
        }
      );

      if (result) {
        currentOptions = { ...currentOptions, ...result };
      }
    }

    return currentOptions;
  }

  async #bindTools(
    model: LanguageModelLike,
    preparedOptions?: ModelRequest
  ): Promise<Runnable> {
    const options: Partial<BaseChatModelCallOptions> = {};
    const structuredTools = Object.values(this.#structuredToolInfo);

    // Use tools from preparedOptions if provided, otherwise use default tools
    const allTools = this.#options.toolClasses.concat(
      ...structuredTools.map((toolStrategy) => toolStrategy.tool),
      ...(preparedOptions?.tools || [])
    );

    /**
     * If there are structured tools, we need to set the tool choice to "any"
     * so that the model can choose to use a structured tool or not.
     */
    const toolChoice =
      preparedOptions?.toolChoice ||
      (structuredTools.length > 0 ? "any" : undefined);

    /**
     * check if the user requests a native schema output
     */
    if (this.#options.responseFormat instanceof ProviderStrategy) {
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
    });

    /**
     * Create a model runnable with the prompt and agent name
     */
    const modelRunnable = getPromptRunnable(
      (preparedOptions?.systemMessage as SystemMessage) ?? this.#options.prompt
    ).pipe(
      this.#options.includeAgentName === "inline"
        ? withAgentName(modelWithTools, this.#options.includeAgentName)
        : modelWithTools
    );

    return modelRunnable;
  }

  static get nodeOptions(): {
    input: z.ZodObject<{ messages: z.ZodArray<z.ZodType<BaseMessage>> }>;
  } {
    return {
      input: z.object({
        messages: z.array(z.custom<BaseMessage>()),
      }),
    };
  }
}
