import {
  RunnableSequence,
  RunnableBinding,
  RunnableConfig,
} from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import { type LanguageModelLike } from "@langchain/core/language_models/base";
import type { InteropZodObject } from "@langchain/core/utils/types";

import { RunnableCallable } from "../RunnableCallable.js";
import { PreHookAnnotation } from "../annotation.js";
import { isBaseChatModel, isConfigurableModel } from "../utils.js";
import {
  AgentState,
  AnyAnnotationRoot,
  CreateReactAgentParams,
  ConfigurableModelInterface,
  StructuredResponseSchemaOptions,
} from "../types.js";

export interface StructuredResponseNodeOptions<
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
    "llm" | "responseFormat"
  > {}

export class StructuredResponseNode<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> extends RunnableCallable<
  AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
  { structuredResponse: StructuredResponseFormat }
> {
  #options: StructuredResponseNodeOptions<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema
  >;

  constructor(options: StructuredResponseNodeOptions) {
    super({
      name: "generate_structured_response",
      func: (input, config) => this.#run(input, config as RunnableConfig),
    });

    this.#options = options;
  }

  async #run(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config: RunnableConfig
  ) {
    if (this.#options.responseFormat == null) {
      throw new Error(
        "Attempted to generate structured output with no passed response schema. Please contact us for help."
      );
    }
    const messages = [...state.messages];
    let modelWithStructuredOutput;

    const model: LanguageModelLike =
      typeof this.#options.llm === "function"
        ? await this.#options.llm(state, config)
        : await this.#getModel(this.#options.llm);

    if (!isBaseChatModel(model)) {
      throw new Error(
        `Expected \`llm\` to be a ChatModel with .withStructuredOutput() method, got ${model.constructor.name}`
      );
    }

    if (
      typeof this.#options.responseFormat === "object" &&
      "schema" in this.#options.responseFormat
    ) {
      const { prompt, schema, ...options } = this.#options
        .responseFormat as StructuredResponseSchemaOptions<StructuredResponseFormat>;

      modelWithStructuredOutput = model.withStructuredOutput(schema, options);
      if (prompt != null) {
        messages.unshift(new SystemMessage({ content: prompt }));
      }
    } else {
      modelWithStructuredOutput = model.withStructuredOutput(
        this.#options.responseFormat
      );
    }

    /**
     * Type the config with the strict option for structured output models.
     * (required by some models, like OpenAI)
     */
    const invokeConfig = {
      ...config,
      strict: true,
    } as RunnableConfig;

    const response = await modelWithStructuredOutput.invoke(
      messages,
      invokeConfig
    );
    return { structuredResponse: response };
  }

  async #getModel(
    llm: LanguageModelLike | ConfigurableModelInterface
  ): Promise<LanguageModelLike> {
    /**
     * If model is a RunnableSequence, find a RunnableBinding or BaseChatModel
     * in its steps
     */
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

    // Get the underlying model from a RunnableBinding
    if (RunnableBinding.isRunnableBinding(model)) {
      model = model.bound;
    }

    if (!isBaseChatModel(model)) {
      throw new Error(
        `Expected \`llm\` to be a ChatModel or RunnableBinding (e.g. llm.bind_tools(...)) with invoke() and generate() methods, got ${model.constructor.name}`
      );
    }

    return model;
  }
}
