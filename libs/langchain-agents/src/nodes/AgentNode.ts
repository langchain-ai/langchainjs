import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage, AIMessage } from "@langchain/core/messages";
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
} from "../utils.js";
import {
  AgentState,
  ClientTool,
  ServerTool,
  AnyAnnotationRoot,
  CreateReactAgentParams,
} from "../types.js";
import { withAgentName } from "../withAgentName.js";
import { PredicateFunction } from "../stopWhen.js";

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
    "llm" | "prompt" | "includeAgentName" | "name" | "stopWhen"
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
  { messages: BaseMessage[] }
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
      name: options.name ?? "agent",
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
     * Check if we should stop the agent.
     */
    const stopWhenResults = await Promise.all(
      this.#stopWhen.map((stopWhen) => stopWhen(state, config))
    );
    const shouldStop = stopWhenResults.filter((result) => result.shouldStop);
    if (shouldStop.length > 0) {
      const shouldStopReasoning =
        shouldStop.length === 1
          ? `A stop condition was met: ${shouldStop[0].description}`
          : `Multiple stop conditions were met: ${shouldStop
              .map((result) => result.description)
              .join(", ")}`;
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

    return { messages: [response] };
  }

  #areMoreStepsNeeded(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    response: BaseMessage
  ): boolean {
    const hasToolCalls = response instanceof AIMessage && response.tool_calls;
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
          (remainingSteps < 2 && hasToolCalls))
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

    return getPromptRunnable(this.#options.prompt).pipe(
      this.#options.includeAgentName === "inline"
        ? withAgentName(model, this.#options.includeAgentName)
        : model
    );
  }
}
