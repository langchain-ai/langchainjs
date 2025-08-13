import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import type { InteropZodObject } from "@langchain/core/utils/types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

import { RunnableCallable } from "../RunnableCallable.js";
import { PreHookAnnotation } from "../annotation.js";
import { shouldBindTools, bindTools, getPromptRunnable } from "../utils.js";
import {
  AgentState,
  ClientTool,
  ServerTool,
  AnyAnnotationRoot,
  CreateReactAgentParams,
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
    "llm" | "prompt" | "includeAgentName"
  > {
  toolClasses: (ClientTool | ServerTool)[];
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

  constructor(
    options: AgentNodeOptions<
      StateSchema,
      StructuredResponseFormat,
      ContextSchema
    >
  ) {
    super({
      name: "agent",
      func: (input, config) => this.#run(input, config as RunnableConfig),
    });

    this.#options = options;
  }

  async #run(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ) {
    // NOTE: we're dynamically creating the model runnable here
    // to ensure that we can validate ConfigurableModel properly
    const modelRunnable: Runnable =
      typeof this.#options.llm === "function"
        ? await this.#getDynamicModel(this.#options.llm, state, config)
        : await this.#getStaticModel(this.#options.llm);

    // TODO: Auto-promote streaming.
    const response = (await modelRunnable.invoke(
      this.#getModelInputState(state),
      config
    )) as BaseMessage;
    // add agent name to the AIMessage
    // TODO: figure out if we can avoid mutating the message directly
    response.name = this.name;
    response.lc_kwargs.name = this.name;
    return { messages: [response] };
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

    return getPromptRunnable(this.#options.prompt).pipe(
      this.#options.includeAgentName === "inline"
        ? withAgentName(model, this.#options.includeAgentName)
        : model
    );
  }
}
