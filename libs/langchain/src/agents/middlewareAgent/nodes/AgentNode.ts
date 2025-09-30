/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { Command, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  InteropZodObject,
  getSchemaDescription,
  interopParse,
} from "@langchain/core/utils/types";

import { initChatModel } from "../../../chat_models/universal.js";
import { RunnableCallable } from "../../RunnableCallable.js";
import { PreHookAnnotation, AnyAnnotationRoot } from "../../annotation.js";
import {
  bindTools,
  getPromptRunnable,
  validateLLMHasNoBoundTools,
  hasToolCalls,
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
import { hasSupportForJsonSchemaOutput } from "../../responses.js";
import { parseToolCalls, type ResponseFormat } from "./utils.js";

export interface AgentNodeOptions<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends Pick<
    CreateAgentParams<StructuredResponseFormat, ContextSchema>,
    | "model"
    | "systemPrompt"
    | "includeAgentName"
    | "name"
    | "responseFormat"
    | "middleware"
  > {
  toolClasses: (ClientTool | ServerTool)[];
  shouldReturnDirect: Set<string>;
  signal?: AbortSignal;
  modifyModelRequestHookMiddleware?: [
    AgentMiddleware<any, any, any>,
    () => any
  ][];
  /**
   * Pre-computed structured response format.
   * This ensures consistent tool names across AgentNode and StructuredResponseNode.
   */
  structuredResponseFormat?: ResponseFormat;
}

export class AgentNode<
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends RunnableCallable<
  InternalAgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  { messages: BaseMessage[] }
> {
  #options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>;

  constructor(
    options: AgentNodeOptions<StructuredResponseFormat, ContextSchema>
  ) {
    super({
      name: options.name ?? "model",
      func: (input, config) =>
        this.#run(input, config as RunnableConfig) as any,
    });

    this.#options = options;
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
    state: InternalAgentState<StructuredResponseFormat> &
      PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<AIMessage | Command> {
    const model = await this.#deriveModel();

    /**
     * Execute modifyModelRequest hooks from beforeModelNodes
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

    /**
     * Use messages from preparedOptions if provided
     */
    if (preparedOptions?.messages) {
      modelInput = { ...modelInput, messages: preparedOptions.messages };
    }

    const signal = mergeAbortSignals(this.#options.signal, config.signal);
    const invokeConfig = { ...config, signal };
    const response = (await modelWithTools.invoke(
      modelInput,
      invokeConfig
    )) as AIMessage;

    return response;
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
      !this.#options.modifyModelRequestHookMiddleware ||
      this.#options.modifyModelRequestHookMiddleware.length === 0
    ) {
      return undefined;
    }

    /**
     * Get the prompt for system message
     */
    const systemPrompt = this.#options.systemPrompt;

    /**
     * Prepare the initial call options
     */
    let currentOptions: ModelRequest = {
      model,
      systemPrompt,
      messages: state.messages,
      tools: this.#options.toolClasses.map((tool) => tool.name as string),
    };

    /**
     * Execute modifyModelRequest hooks from all middleware
     */
    const middlewareList = this.#options.modifyModelRequestHookMiddleware;
    for (const [middleware, getMiddlewareState] of middlewareList) {
      /**
       * Merge context with default context of middleware
       */
      const context = middleware.contextSchema
        ? interopParse(middleware.contextSchema, config?.context || {})
        : config?.context;

      /**
       * Create runtime
       */
      const runtime: Runtime<unknown, unknown> = {
        toolCalls: parseToolCalls(state.messages),
        tools: this.#options.toolClasses,
        context,
        writer: config.writer,
        interrupt: config.interrupt,
        signal: config.signal,
        terminate: (result) => ({ type: "terminate", result }),
      };

      const result = await middleware.modifyModelRequest!(
        currentOptions,
        {
          messages: state.messages,
          ...getMiddlewareState(),
        },
        /**
         * ensure runtime is frozen to prevent modifications
         */
        Object.freeze({
          ...runtime,
          context,
        })
      );

      /**
       * raise meaningful error if unknown tools were selected
       */
      const unknownTools =
        result?.tools?.filter(
          (tool) => !this.#options.toolClasses.some((t) => t.name === tool)
        ) ?? [];
      if (unknownTools.length > 0) {
        throw new Error(
          `Unknown tools selected in middleware "${
            middleware.name
          }": ${unknownTools.join(
            ", "
          )}, available tools: ${this.#options.toolClasses
            .map((t) => t.name)
            .join(", ")}!`
        );
      }

      if (result) {
        currentOptions = { ...currentOptions, ...result };
      }
    }

    return currentOptions;
  }

  async #bindTools(
    model: LanguageModelLike,
    preparedOptions: ModelRequest | undefined
  ): Promise<Runnable> {
    const structuredResponseFormat = this.#options.structuredResponseFormat;
    const options: Partial<BaseChatModelCallOptions> = {};
    const structuredTools = Object.values(
      structuredResponseFormat && "tools" in structuredResponseFormat
        ? structuredResponseFormat.tools
        : {}
    );

    // Use tools from preparedOptions if provided, otherwise use default tools
    const preparedTools = preparedOptions?.tools ?? [];
    const allTools = [
      ...(preparedTools.length > 0
        ? this.#options.toolClasses.filter(
            (tool) =>
              typeof tool.name === "string" && preparedTools.includes(tool.name)
          )
        : this.#options.toolClasses),
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
      /**
       * if the model does not support JSON schema output, throw an error
       */
      if (!hasSupportForJsonSchemaOutput(model)) {
        throw new Error(
          "Model does not support native structured output responses. Please use a model that supports native structured output responses or use a tool output."
        );
      }

      const jsonSchemaParams = {
        name: structuredResponseFormat.strategy.schema?.name ?? "extract",
        description: getSchemaDescription(
          structuredResponseFormat.strategy.schema
        ),
        schema: structuredResponseFormat.strategy.schema,
        strict: true,
      };

      Object.assign(options, {
        response_format: {
          type: "json_schema",
          json_schema: jsonSchemaParams,
        },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: structuredResponseFormat.strategy.schema,
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
      preparedOptions?.systemPrompt ?? this.#options.systemPrompt
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
