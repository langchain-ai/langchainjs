import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import {
  BaseMessage,
  AIMessage,
  isAIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import { type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  InteropZodObject,
  getSchemaDescription,
} from "@langchain/core/utils/types";

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
  AgentState,
  ClientTool,
  ServerTool,
  AnyAnnotationRoot,
  CreateReactAgentParams,
  PredicateFunction,
} from "../types.js";
import { withAgentName } from "../withAgentName.js";
import {
  ToolOutput,
  NativeOutput,
  transformResponseFormat,
} from "../responses.js";

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
  AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  { messages: BaseMessage[] } | { structuredResponse: StructuredResponseFormat }
> {
  #options: AgentNodeOptions<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema
  >;

  #cachedStaticModel?: Runnable;

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
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
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
      | { structuredResponse: StructuredResponseFormat } =
      await this.#invokeModel(state, config);

    if ("structuredResponse" in response) {
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

  async #invokeModel(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig,
    options: {
      lastMessage?: string;
      isDirectReturn?: boolean;
    } = {}
  ): Promise<
    | AIMessage
    | { structuredResponse: StructuredResponseFormat; messages?: BaseMessage[] }
  > {
    const model = await this.#getBaseModel(state, config);
    const modelWithTools = await this.#bindTools(
      model,
      options?.isDirectReturn
        ? {
            tool_choice: {
              type: "tool",
              name: Object.keys(this.#structuredToolInfo)[0],
            },
          }
        : {}
    );
    const modelInput = this.#getModelInputState(state);
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
      throw new Error("Multiple structured tool calls are not supported");
    }

    const toolCall = toolCalls[0];
    const tool = this.#structuredToolInfo[toolCall.name];
    const structuredResponse = tool.parse(
      toolCall.args
    ) as StructuredResponseFormat;

    return {
      structuredResponse,
      messages: [
        new AIMessage(
          options.lastMessage ??
            `Returning structured response: ${JSON.stringify(
              structuredResponse
            )}`
        ),
      ],
    };
  }

  #areMoreStepsNeeded(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
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
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"]
  ): Omit<AgentState<StructuredResponseFormat>, "llmInputMessages"> {
    const { messages, llmInputMessages, ...rest } = state;
    if (llmInputMessages && llmInputMessages.length > 0) {
      return { messages: llmInputMessages, ...rest } as Omit<
        AgentState<StructuredResponseFormat>,
        "llmInputMessages"
      >;
    }
    return { messages, ...rest } as Omit<
      AgentState<StructuredResponseFormat>,
      "llmInputMessages"
    >;
  }

  /**
   * Get the base model from the options with bound tools
   * @param state - The state of the agent
   * @param config - The config of the agent
   * @returns The base model
   */
  async #getBaseModel(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<LanguageModelLike> {
    /**
     * If the model has already been cached, return it
     */
    if (this.#cachedStaticModel) {
      return this.#cachedStaticModel;
    }

    const model: LanguageModelLike =
      typeof this.#options.llm === "function"
        ? await this.#options.llm(state, config)
        : this.#options.llm;

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    validateLLMHasNoBoundTools(model);

    /**
     * cache the model for future use if it is NOT a dynamic model
     */
    if (typeof this.#options.llm !== "function") {
      this.#cachedStaticModel = model;
    }

    return model;
  }

  async #bindTools(
    model: LanguageModelLike,
    bindOptions?: Partial<BaseChatModelCallOptions>
  ): Promise<Runnable> {
    const options: Partial<BaseChatModelCallOptions> = {};
    const structuredTools = Object.values(this.#structuredToolInfo);
    const allTools = this.#options.toolClasses.concat(
      ...structuredTools.map((toolOutput) => toolOutput.tool)
    );

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
