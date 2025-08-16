import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
  isAIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import type { InteropZodObject } from "@langchain/core/utils/types";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

import { RunnableCallable } from "../RunnableCallable.js";
import { PreHookAnnotation } from "../annotation.js";
import {
  shouldBindTools,
  bindTools,
  getPromptRunnable,
  validateLLMHasNoBoundTools,
  isBaseChatModel,
  hasToolCalls,
  hasSupportForStructuredOutput,
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
       * If responseFormat is set, generate structured response
       */
      if (this.#options.responseFormat) {
        return this.#generateStructuredResponse(state, config);
      }
      /**
       * Otherwise, we shouldn't be here - the graph routing should have ended
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

      if (this.#options.responseFormat) {
        state.messages.push(new AIMessage(shouldStopReasoning));
        return this.#generateStructuredResponse(state, config);
      }

      return { messages: [shouldStopReasoning] };
    }

    /**
     * We're dynamically creating the model runnable here
     * to ensure that we can validate ConfigurableModel properly
     */
    const modelRunnable: Runnable =
      typeof this.#options.llm === "function"
        ? await this.#getDynamicModel(this.#options.llm, state, config)
        : await this.#getStaticModel(this.#options.llm);

    const modelInput = this.#getModelInputState(state);
    const response = (await modelRunnable.invoke(
      modelInput,
      config
    )) as AIMessage;

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

    /**
     * Check if we need to generate a structured response
     * This happens when:
     * 1. responseFormat is set
     * 2. The agent has no more tool calls to make
     */
    if (
      this.#options.responseFormat &&
      (!response.tool_calls || response.tool_calls.length === 0)
    ) {
      return this.#generateStructuredResponse(state, config);
    }

    return { messages: [response] };
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
      return { messages: llmInputMessages, ...rest };
    }
    return { messages, ...rest };
  }

  async #getStaticModel(llm: LanguageModelLike): Promise<Runnable> {
    if (this.#cachedStaticModel) {
      return this.#cachedStaticModel;
    }

    const modelWithTools: LanguageModelLike = (await shouldBindTools(
      llm,
      this.#options.toolClasses
    ))
      ? await bindTools(llm, this.#options.toolClasses)
      : llm;

    const promptRunnable = getPromptRunnable(this.#options.prompt);
    const modelRunnable =
      this.#options.includeAgentName === "inline"
        ? withAgentName(modelWithTools, this.#options.includeAgentName)
        : modelWithTools;

    this.#cachedStaticModel = promptRunnable.pipe(modelRunnable);
    return this.#cachedStaticModel;
  }

  async #getDynamicModel(
    llm: (
      state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
      runtime: LangGraphRunnableConfig
    ) => Promise<LanguageModelLike> | LanguageModelLike,
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: LangGraphRunnableConfig
  ) {
    const model = await llm(state, config);

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    validateLLMHasNoBoundTools(model);

    /**
     * Bind tools to the model if they are not already bound.
     */
    const modelWithTools: LanguageModelLike = (await shouldBindTools(
      model,
      this.#options.toolClasses
    ))
      ? await bindTools(model, this.#options.toolClasses)
      : model;

    return getPromptRunnable(this.#options.prompt).pipe(
      this.#options.includeAgentName === "inline"
        ? withAgentName(modelWithTools, this.#options.includeAgentName)
        : modelWithTools
    );
  }

  /**
   * Get the base model from the options
   * @param state - The state of the agent
   * @param config - The config of the agent
   * @returns The base model
   */
  async #getBaseModel(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<LanguageModelLike> {
    const model: LanguageModelLike =
      typeof this.#options.llm === "function"
        ? await this.#options.llm(state, config)
        : this.#options.llm;
    return model;
  }

  async #generateStructuredResponse(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ): Promise<{ structuredResponse: StructuredResponseFormat }> {
    if (this.#options.responseFormat == null) {
      throw new Error(
        "Attempted to generate structured output with no passed response schema."
      );
    }

    const modelWithStructuredOutput = await this.#getModelWithStructuredOutput(
      state,
      config,
      this.#options.responseFormat
    );
    const messages = [...state.messages];

    /**
     * Get the base model to access model name
     */
    const baseModel = await this.#getBaseModel(state, config);
    if (isBaseChatModel(baseModel)) {
      const identifyingParams = baseModel._identifyingParams();
      const modelName = identifyingParams.model_name || identifyingParams.model;

      /**
       * If the model supports structured output, we can use the structured output feature
       */
      if (hasSupportForStructuredOutput(modelName)) {
        const structuredResponse = (await modelWithStructuredOutput.invoke(
          messages,
          {
            ...config,
            /**
             * Ensure the model returns a structured response
             */
            strict: true,
            tool_choice: "none",
          } as RunnableConfig
        )) as StructuredResponseFormat;
        return { structuredResponse };
      }
    }

    const structuredResponse = (await modelWithStructuredOutput.invoke(
      messages,
      config
    )) as StructuredResponseFormat;
    return { structuredResponse };
  }

  async #getModelWithStructuredOutput(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig,
    responseFormat: Required<
      CreateReactAgentParams<
        StateSchema,
        StructuredResponseFormat,
        ContextSchema
      >
    >["responseFormat"]
  ) {
    const model: LanguageModelLike = await this.#getBaseModel(state, config);

    if (!isBaseChatModel(model)) {
      throw new Error(
        `Expected \`llm\` to be a ChatModel with .withStructuredOutput() method, got ${model.constructor.name}`
      );
    }

    /**
     * Inject a system message when using a custom JSON schema
     */
    if (typeof responseFormat === "object" && "schema" in responseFormat) {
      const { prompt, schema, ...options } = responseFormat;
      const modelWithStructuredOutput = model.withStructuredOutput(
        schema,
        options
      );
      if (prompt != null) {
        state.messages.unshift(new SystemMessage({ content: prompt }));
      }

      return modelWithStructuredOutput;
    }

    /**
     * Zod schema
     */
    return model.withStructuredOutput(responseFormat);
  }
}
