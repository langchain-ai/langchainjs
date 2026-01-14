/* eslint-disable no-instanceof/no-instanceof */
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import {
  BaseMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Command, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  InteropZodObject,
  getSchemaDescription,
  interopParse,
  interopZodObjectPartial,
} from "@langchain/core/utils/types";
import { raceWithSignal } from "@langchain/core/runnables";
import type { ToolCall } from "@langchain/core/messages/tool";
import type { ClientTool, ServerTool } from "@langchain/core/tools";

import { initChatModel } from "../../chat_models/universal.js";
import { MultipleStructuredOutputsError, MiddlewareError } from "../errors.js";
import { RunnableCallable } from "../RunnableCallable.js";
import {
  bindTools,
  validateLLMHasNoBoundTools,
  hasToolCalls,
  isClientTool,
} from "../utils.js";
import { mergeAbortSignals } from "../nodes/utils.js";
import { CreateAgentParams } from "../types.js";
import type { InternalAgentState, Runtime } from "../runtime.js";
import type {
  AgentMiddleware,
  AnyAnnotationRoot,
  WrapModelCallHandler,
} from "../middleware/types.js";
import type { ModelRequest } from "./types.js";
import { withAgentName } from "../withAgentName.js";
import {
  ToolStrategy,
  ProviderStrategy,
  transformResponseFormat,
  ToolStrategyError,
} from "../responses.js";

type ResponseHandlerResult<StructuredResponseFormat> =
  | {
      structuredResponse: StructuredResponseFormat;
      messages: BaseMessage[];
    }
  | Promise<Command>;

/**
 * Wrap the base handler with middleware wrapModelCall hooks
 * Middleware are composed so the first middleware is the outermost wrapper
 * Example: [auth, retry, cache] means auth wraps retry wraps cache wraps baseHandler
 */
type InternalModelResponse<StructuredResponseFormat> =
  | AIMessage
  | ResponseHandlerResult<StructuredResponseFormat>;

/**
 * Check if the response is an internal model response.
 * @param response - The response to check.
 * @returns True if the response is an internal model response, false otherwise.
 */
function isInternalModelResponse<StructuredResponseFormat>(
  response: unknown
): response is InternalModelResponse<StructuredResponseFormat> {
  return (
    AIMessage.isInstance(response) ||
    (typeof response === "object" &&
      response !== null &&
      "structuredResponse" in response &&
      "messages" in response)
  );
}

/**
 * The name of the agent node in the state graph.
 */
export const AGENT_NODE_NAME = "model_request";

export interface AgentNodeOptions<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
> extends Pick<
    CreateAgentParams<StructuredResponseFormat, StateSchema, ContextSchema>,
    "model" | "includeAgentName" | "name" | "responseFormat" | "middleware"
  > {
  toolClasses: (ClientTool | ServerTool)[];
  shouldReturnDirect: Set<string>;
  signal?: AbortSignal;
  systemMessage: SystemMessage;
  wrapModelCallHookMiddleware?: [
    AgentMiddleware,
    () => Record<string, unknown>,
  ][];
}

interface NativeResponseFormat {
  type: "native";
  strategy: ProviderStrategy;
}

interface ToolResponseFormat {
  type: "tool";
  tools: Record<string, ToolStrategy>;
}

type ResponseFormat = NativeResponseFormat | ToolResponseFormat;

export class AgentNode<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
> extends RunnableCallable<
  InternalAgentState<StructuredResponseFormat>,
  | (
      | { messages: BaseMessage[] }
      | { structuredResponse: StructuredResponseFormat }
    )
  | Command
> {
  #options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>;
  #systemMessage: SystemMessage;
  #currentSystemMessage: SystemMessage;

  constructor(
    options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>
  ) {
    super({
      name: options.name ?? "model",
      func: (input, config) => this.#run(input, config as RunnableConfig),
    });

    this.#options = options;
    this.#systemMessage = options.systemMessage;
  }

  /**
   * Returns response format primtivies based on given model and response format provided by the user.
   *
   * If the user selects a tool output:
   * - return a record of tools to extract structured output from the model's response
   *
   * if the the user selects a native schema output or if the model supports JSON schema output:
   * - return a provider strategy to extract structured output from the model's response
   *
   * @param model - The model to get the response format for.
   * @returns The response format.
   */
  #getResponseFormat(
    model: string | LanguageModelLike
  ): ResponseFormat | undefined {
    if (!this.#options.responseFormat) {
      return undefined;
    }

    const strategies = transformResponseFormat(
      this.#options.responseFormat,
      undefined,
      model
    );

    /**
     * we either define a list of provider strategies or a list of tool strategies
     */
    const isProviderStrategy = strategies.every(
      (format) => format instanceof ProviderStrategy
    );

    /**
     * Populate a list of structured tool info.
     */
    if (!isProviderStrategy) {
      return {
        type: "tool",
        tools: (
          strategies.filter(
            (format) => format instanceof ToolStrategy
          ) as ToolStrategy[]
        ).reduce(
          (acc, format) => {
            acc[format.name] = format;
            return acc;
          },
          {} as Record<string, ToolStrategy>
        ),
      };
    }

    return {
      type: "native",
      /**
       * there can only be one provider strategy
       */
      strategy: strategies[0] as ProviderStrategy,
    };
  }

  async #run(
    state: InternalAgentState<StructuredResponseFormat>,
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
  #deriveModel() {
    if (typeof this.#options.model === "string") {
      return initChatModel(this.#options.model);
    }

    if (this.#options.model) {
      return this.#options.model;
    }

    throw new Error("No model option was provided, either via `model` option.");
  }

  async #invokeModel(
    state: InternalAgentState<StructuredResponseFormat>,
    config: RunnableConfig,
    options: {
      lastMessage?: string;
    } = {}
  ): Promise<AIMessage | ResponseHandlerResult<StructuredResponseFormat>> {
    const model = await this.#deriveModel();
    const lgConfig = config as LangGraphRunnableConfig;

    /**
     * Create the base handler that performs the actual model invocation
     */
    const baseHandler = async (
      request: ModelRequest
    ): Promise<AIMessage | ResponseHandlerResult<StructuredResponseFormat>> => {
      /**
       * Check if the LLM already has bound tools and throw if it does.
       */
      validateLLMHasNoBoundTools(request.model);

      const structuredResponseFormat = this.#getResponseFormat(request.model);
      const modelWithTools = await this.#bindTools(
        request.model,
        request,
        structuredResponseFormat
      );

      /**
       * prepend the system message to the messages if it is not empty
       */
      const messages = [
        ...(this.#currentSystemMessage.text === ""
          ? []
          : [this.#currentSystemMessage]),
        ...request.messages,
      ];

      const signal = mergeAbortSignals(this.#options.signal, config.signal);
      const response = (await raceWithSignal(
        modelWithTools.invoke(messages, {
          ...config,
          signal,
        }),
        signal
      )) as AIMessage;

      /**
       * if the user requests a native schema output, try to parse the response
       * and return the structured response if it is valid
       */
      if (structuredResponseFormat?.type === "native") {
        const structuredResponse =
          structuredResponseFormat.strategy.parse(response);
        if (structuredResponse) {
          return { structuredResponse, messages: [response] };
        }

        return response;
      }

      if (!structuredResponseFormat || !response.tool_calls) {
        return response;
      }

      const toolCalls = response.tool_calls.filter(
        (call) => call.name in structuredResponseFormat.tools
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
        return this.#handleMultipleStructuredOutputs(
          response,
          toolCalls,
          structuredResponseFormat
        );
      }

      const toolStrategy = structuredResponseFormat.tools[toolCalls[0].name];
      const toolMessageContent = toolStrategy?.options?.toolMessageContent;
      return this.#handleSingleStructuredOutput(
        response,
        toolCalls[0],
        structuredResponseFormat,
        toolMessageContent ?? options.lastMessage
      );
    };

    const wrapperMiddleware = this.#options.wrapModelCallHookMiddleware ?? [];
    let wrappedHandler: (
      request: ModelRequest<
        InternalAgentState<StructuredResponseFormat>,
        unknown
      >
    ) => Promise<InternalModelResponse<StructuredResponseFormat>> = baseHandler;

    /**
     * Build composed handler from last to first so first middleware becomes outermost
     */
    for (let i = wrapperMiddleware.length - 1; i >= 0; i--) {
      const [middleware, getMiddlewareState] = wrapperMiddleware[i];
      if (middleware.wrapModelCall) {
        const innerHandler = wrappedHandler;
        const currentMiddleware = middleware;
        const currentGetState = getMiddlewareState;

        wrappedHandler = async (
          request: ModelRequest<
            InternalAgentState<StructuredResponseFormat>,
            unknown
          >
        ): Promise<InternalModelResponse<StructuredResponseFormat>> => {
          /**
           * Merge context with default context of middleware
           */
          const context = currentMiddleware.contextSchema
            ? interopParse(
                currentMiddleware.contextSchema,
                lgConfig?.context || {}
              )
            : lgConfig?.context;

          /**
           * Create runtime
           */
          const runtime: Runtime<unknown> = Object.freeze({
            context,
            writer: lgConfig.writer,
            interrupt: lgConfig.interrupt,
            signal: lgConfig.signal,
          });

          /**
           * Create the request with state and runtime
           */
          const requestWithStateAndRuntime: ModelRequest<
            InternalAgentState<StructuredResponseFormat>,
            unknown
          > = {
            ...request,
            state: {
              ...(middleware.stateSchema
                ? interopParse(
                    interopZodObjectPartial(middleware.stateSchema),
                    state
                  )
                : {}),
              ...currentGetState(),
              messages: state.messages,
            } as InternalAgentState<StructuredResponseFormat>,
            runtime,
          };

          /**
           * Create handler that validates tools and calls the inner handler
           */
          const handlerWithValidation = async (
            req: ModelRequest<
              InternalAgentState<StructuredResponseFormat>,
              unknown
            >
          ): Promise<InternalModelResponse<StructuredResponseFormat>> => {
            /**
             * Verify that the user didn't add any new tools.
             * We can't allow this as the ToolNode is already initiated with given tools.
             */
            const modifiedTools = req.tools ?? [];
            const newTools = modifiedTools.filter(
              (tool) =>
                isClientTool(tool) &&
                !this.#options.toolClasses.some((t) => t.name === tool.name)
            );
            if (newTools.length > 0) {
              throw new Error(
                `You have added a new tool in "wrapModelCall" hook of middleware "${
                  currentMiddleware.name
                }": ${newTools
                  .map((tool) => tool.name)
                  .join(", ")}. This is not supported.`
              );
            }

            /**
             * Verify that user has not added or modified a tool with the same name.
             * We can't allow this as the ToolNode is already initiated with given tools.
             */
            const invalidTools = modifiedTools.filter(
              (tool) =>
                isClientTool(tool) &&
                this.#options.toolClasses.every((t) => t !== tool)
            );
            if (invalidTools.length > 0) {
              throw new Error(
                `You have modified a tool in "wrapModelCall" hook of middleware "${
                  currentMiddleware.name
                }": ${invalidTools
                  .map((tool) => tool.name)
                  .join(", ")}. This is not supported.`
              );
            }

            let normalizedReq = req;
            const hasSystemPromptChanged =
              req.systemPrompt !== this.#currentSystemMessage.text;
            const hasSystemMessageChanged =
              req.systemMessage !== this.#currentSystemMessage;
            if (hasSystemPromptChanged && hasSystemMessageChanged) {
              throw new Error(
                "Cannot change both systemPrompt and systemMessage in the same request."
              );
            }

            /**
             * Check if systemPrompt is a string was changed, if so create a new SystemMessage
             */
            if (hasSystemPromptChanged) {
              this.#currentSystemMessage = new SystemMessage({
                content: [{ type: "text", text: req.systemPrompt }],
              });
              normalizedReq = {
                ...req,
                systemPrompt: this.#currentSystemMessage.text,
                systemMessage: this.#currentSystemMessage,
              };
            }
            /**
             * If the systemMessage was changed, update the current system message
             */
            if (hasSystemMessageChanged) {
              this.#currentSystemMessage = new SystemMessage({
                ...req.systemMessage,
              });
              normalizedReq = {
                ...req,
                systemPrompt: this.#currentSystemMessage.text,
                systemMessage: this.#currentSystemMessage,
              };
            }

            return innerHandler(normalizedReq);
          };

          // Call middleware's wrapModelCall with the validation handler
          if (!currentMiddleware.wrapModelCall) {
            return handlerWithValidation(requestWithStateAndRuntime);
          }

          try {
            const middlewareResponse = await currentMiddleware.wrapModelCall(
              requestWithStateAndRuntime,
              handlerWithValidation as WrapModelCallHandler
            );

            /**
             * Validate that this specific middleware returned a valid AIMessage
             */
            if (!isInternalModelResponse(middlewareResponse)) {
              throw new Error(
                `Invalid response from "wrapModelCall" in middleware "${
                  currentMiddleware.name
                }": expected AIMessage, got ${typeof middlewareResponse}`
              );
            }

            return middlewareResponse;
          } catch (error) {
            throw new MiddlewareError(error, currentMiddleware.name);
          }
        };
      }
    }

    /**
     * Execute the wrapped handler with the initial request
     * Reset current system prompt to initial state and convert to string using .text getter
     * for backwards compatibility with ModelRequest
     */
    this.#currentSystemMessage = this.#systemMessage;
    const initialRequest: ModelRequest<
      InternalAgentState<StructuredResponseFormat>,
      unknown
    > = {
      model,
      systemPrompt: this.#currentSystemMessage?.text,
      systemMessage: this.#currentSystemMessage,
      messages: state.messages,
      tools: this.#options.toolClasses,
      state,
      runtime: Object.freeze({
        context: lgConfig?.context,
        writer: lgConfig.writer,
        interrupt: lgConfig.interrupt,
        signal: lgConfig.signal,
      }) as Runtime<unknown>,
    };

    return wrappedHandler(initialRequest);
  }

  /**
   * If the model returns multiple structured outputs, we need to handle it.
   * @param response - The response from the model
   * @param toolCalls - The tool calls that were made
   * @returns The response from the model
   */
  #handleMultipleStructuredOutputs(
    response: AIMessage,
    toolCalls: ToolCall[],
    responseFormat: ToolResponseFormat
  ): Promise<Command> {
    const multipleStructuredOutputsError = new MultipleStructuredOutputsError(
      toolCalls.map((call) => call.name)
    );

    return this.#handleToolStrategyError(
      multipleStructuredOutputsError,
      response,
      toolCalls[0],
      responseFormat
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
    responseFormat: ToolResponseFormat,
    lastMessage?: string
  ): ResponseHandlerResult<StructuredResponseFormat> {
    const tool = responseFormat.tools[toolCall.name];

    try {
      const structuredResponse = tool.parse(
        toolCall.args
      ) as StructuredResponseFormat;

      return {
        structuredResponse,
        messages: [
          response,
          new ToolMessage({
            tool_call_id: toolCall.id ?? "",
            content: JSON.stringify(structuredResponse),
            name: toolCall.name,
          }),
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
        toolCall,
        responseFormat
      );
    }
  }

  async #handleToolStrategyError(
    error: ToolStrategyError,
    response: AIMessage,
    toolCall: ToolCall,
    responseFormat: ToolResponseFormat
  ): Promise<Command> {
    /**
     * Using the `errorHandler` option of the first `ToolStrategy` entry is sufficient here.
     * There is technically only one `ToolStrategy` entry in `structuredToolInfo` if the user
     * uses `toolStrategy` to define the response format. If the user applies a list of json
     * schema objects, these will be transformed into multiple `ToolStrategy` entries but all
     * with the same `handleError` option.
     */
    const errorHandler = Object.values(responseFormat.tools).at(0)?.options
      ?.handleError;

    const toolCallId = toolCall.id;
    if (!toolCallId) {
      throw new Error(
        "Tool call ID is required to handle tool output errors. Please provide a tool call ID."
      );
    }

    /**
     * Default behavior: retry if `errorHandler` is undefined or truthy.
     * Only throw if explicitly set to `false`.
     */
    if (errorHandler === false) {
      throw error;
    }

    /**
     * retry if:
     */
    if (
      /**
       * if the user has provided truthy value as the `errorHandler`, return a new AIMessage
       * with the error message and retry the tool call.
       */
      errorHandler === undefined ||
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
        goto: AGENT_NODE_NAME,
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
        goto: AGENT_NODE_NAME,
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
        goto: AGENT_NODE_NAME,
      });
    }

    /**
     * Default: retry if we reach here
     */
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
      goto: AGENT_NODE_NAME,
    });
  }

  #areMoreStepsNeeded(
    state: InternalAgentState<StructuredResponseFormat>,
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
          (remainingSteps < 2 && hasToolCalls(state.messages.at(-1))))
    );
  }

  async #bindTools(
    model: LanguageModelLike,
    preparedOptions: ModelRequest | undefined,
    structuredResponseFormat: ResponseFormat | undefined
  ): Promise<Runnable> {
    const options: Partial<BaseChatModelCallOptions> = {};
    const structuredTools = Object.values(
      structuredResponseFormat && "tools" in structuredResponseFormat
        ? structuredResponseFormat.tools
        : {}
    );

    /**
     * Use tools from preparedOptions if provided, otherwise use default tools
     */
    const allTools = [
      ...(preparedOptions?.tools ?? this.#options.toolClasses),
      ...structuredTools.map((toolStrategy) => toolStrategy.tool),
    ];

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
    if (structuredResponseFormat?.type === "native") {
      const resolvedStrict =
        preparedOptions?.modelSettings?.strict ??
        structuredResponseFormat?.strategy?.strict ??
        true;

      const jsonSchemaParams = {
        name: structuredResponseFormat.strategy.schema?.name ?? "extract",
        description: getSchemaDescription(
          structuredResponseFormat.strategy.schema
        ),
        schema: structuredResponseFormat.strategy.schema,
        strict: resolvedStrict,
      };

      Object.assign(options, {
        response_format: {
          type: "json_schema",
          json_schema: jsonSchemaParams,
        },
        output_format: {
          type: "json_schema",
          schema: structuredResponseFormat.strategy.schema,
        },
        headers: {
          "anthropic-beta": "structured-outputs-2025-11-13",
        },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: structuredResponseFormat.strategy.schema,
        },
        strict: resolvedStrict,
      });
    }

    /**
     * Bind tools to the model if they are not already bound.
     */
    const modelWithTools = await bindTools(model, allTools, {
      ...options,
      ...(preparedOptions?.modelSettings ?? {}),
      tool_choice: toolChoice,
    });

    /**
     * Create a model runnable with the prompt and agent name
     * Use current SystemMessage state (which may have been modified by middleware)
     */
    const modelRunnable =
      this.#options.includeAgentName === "inline"
        ? withAgentName(modelWithTools, this.#options.includeAgentName)
        : modelWithTools;

    return modelRunnable;
  }

  getState(): {
    messages: BaseMessage[];
  } {
    const state = super.getState();
    const origState = state && !(state instanceof Command) ? state : {};

    return {
      messages: [],
      ...origState,
    };
  }
}
