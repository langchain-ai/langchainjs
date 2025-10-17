import type { Tiktoken, TiktokenModel } from "js-tiktoken/lite";
import type { ZodType as ZodTypeV3 } from "zod/v3";
import type { $ZodType as ZodTypeV4 } from "zod/v4/core";

import { type BaseCache, InMemoryCache } from "../caches/base.js";
import {
  type BasePromptValueInterface,
  StringPromptValue,
  ChatPromptValue,
} from "../prompt_values.js";
import {
  type BaseMessage,
  type BaseMessageLike,
  type MessageContent,
} from "../messages/base.js";
import { coerceMessageLikeToMessage } from "../messages/utils.js";
import { type LLMResult } from "../outputs.js";
import { CallbackManager, Callbacks } from "../callbacks/manager.js";
import { AsyncCaller, AsyncCallerParams } from "../utils/async_caller.js";
import { encodingForModel } from "../utils/tiktoken.js";
import { Runnable, type RunnableInterface } from "../runnables/base.js";
import { RunnableConfig } from "../runnables/config.js";
import { JSONSchema } from "../utils/json_schema.js";
import {
  InferInteropZodOutput,
  InteropZodObject,
  InteropZodType,
} from "../utils/types/zod.js";

// https://www.npmjs.com/package/js-tiktoken

export const getModelNameForTiktoken = (modelName: string): TiktokenModel => {
  if (modelName.startsWith("gpt-3.5-turbo-16k")) {
    return "gpt-3.5-turbo-16k";
  }

  if (modelName.startsWith("gpt-3.5-turbo-")) {
    return "gpt-3.5-turbo";
  }

  if (modelName.startsWith("gpt-4-32k")) {
    return "gpt-4-32k";
  }

  if (modelName.startsWith("gpt-4-")) {
    return "gpt-4";
  }

  if (modelName.startsWith("gpt-4o")) {
    return "gpt-4o";
  }

  return modelName as TiktokenModel;
};

export const getEmbeddingContextSize = (modelName?: string): number => {
  switch (modelName) {
    case "text-embedding-ada-002":
      return 8191;
    default:
      return 2046;
  }
};

export const getModelContextSize = (modelName: string): number => {
  switch (getModelNameForTiktoken(modelName)) {
    case "gpt-3.5-turbo-16k":
      return 16384;
    case "gpt-3.5-turbo":
      return 4096;
    case "gpt-4-32k":
      return 32768;
    case "gpt-4":
      return 8192;
    case "text-davinci-003":
      return 4097;
    case "text-curie-001":
      return 2048;
    case "text-babbage-001":
      return 2048;
    case "text-ada-001":
      return 2048;
    case "code-davinci-002":
      return 8000;
    case "code-cushman-001":
      return 2048;
    default:
      return 4097;
  }
};

/**
 * Whether or not the input matches the OpenAI tool definition.
 * @param {unknown} tool The input to check.
 * @returns {boolean} Whether the input is an OpenAI tool definition.
 */
export function isOpenAITool(tool: unknown): tool is ToolDefinition {
  if (typeof tool !== "object" || !tool) return false;
  if (
    "type" in tool &&
    tool.type === "function" &&
    "function" in tool &&
    typeof tool.function === "object" &&
    tool.function &&
    "name" in tool.function &&
    "parameters" in tool.function
  ) {
    return true;
  }
  return false;
}

interface CalculateMaxTokenProps {
  prompt: string;
  modelName: TiktokenModel;
}

export const calculateMaxTokens = async ({
  prompt,
  modelName,
}: CalculateMaxTokenProps) => {
  let numTokens;

  try {
    numTokens = (
      await encodingForModel(getModelNameForTiktoken(modelName))
    ).encode(prompt).length;
  } catch (error) {
    console.warn(
      "Failed to calculate number of tokens, falling back to approximate count"
    );

    // fallback to approximate calculation if tiktoken is not available
    // each token is ~4 characters: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them#
    numTokens = Math.ceil(prompt.length / 4);
  }

  const maxTokens = getModelContextSize(modelName);
  return maxTokens - numTokens;
};

const getVerbosity = () => false;

export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export interface BaseLangChainParams {
  verbose?: boolean;
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Base class for language models, chains, tools.
 */
export abstract class BaseLangChain<
    RunInput,
    RunOutput,
    CallOptions extends RunnableConfig = RunnableConfig
  >
  extends Runnable<RunInput, RunOutput, CallOptions>
  implements BaseLangChainParams
{
  /**
   * Whether to print out response text.
   */
  verbose: boolean;

  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  get lc_attributes(): { [key: string]: undefined } | undefined {
    return {
      callbacks: undefined,
      verbose: undefined,
    };
  }

  constructor(params: BaseLangChainParams) {
    super(params);
    this.verbose = params.verbose ?? getVerbosity();
    this.callbacks = params.callbacks;
    this.tags = params.tags ?? [];
    this.metadata = params.metadata ?? {};
  }
}

/**
 * Base interface for language model parameters.
 * A subclass of {@link BaseLanguageModel} should have a constructor that
 * takes in a parameter that extends this interface.
 */
export interface BaseLanguageModelParams
  extends AsyncCallerParams,
    BaseLangChainParams {
  /**
   * @deprecated Use `callbacks` instead
   */
  callbackManager?: CallbackManager;

  cache?: BaseCache | boolean;
}

export interface BaseLanguageModelTracingCallOptions {
  /**
   * Describes the format of structured outputs.
   * This should be provided if an output is considered to be structured
   */
  ls_structured_output_format?: {
    /**
     * An object containing the method used for structured output (e.g., "jsonMode").
     */
    kwargs: { method: string };
    /**
     * The JSON schema describing the expected output structure.
     */
    schema?: JSONSchema;
  };
}

export interface BaseLanguageModelCallOptions
  extends RunnableConfig,
    BaseLanguageModelTracingCallOptions {
  /**
   * Stop tokens to use for this call.
   * If not provided, the default stop tokens for the model will be used.
   */
  stop?: string[];
}

export interface FunctionDefinition {
  /**
   * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
   * underscores and dashes, with a maximum length of 64.
   */
  name: string;

  /**
   * The parameters the functions accepts, described as a JSON Schema object. See the
   * [guide](https://platform.openai.com/docs/guides/gpt/function-calling) for
   * examples, and the
   * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
   * documentation about the format.
   *
   * To describe a function that accepts no parameters, provide the value
   * `{"type": "object", "properties": {}}`.
   */
  parameters: Record<string, unknown> | JSONSchema;

  /**
   * A description of what the function does, used by the model to choose when and
   * how to call the function.
   */
  description?: string;
}

export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

export type FunctionCallOption = {
  name: string;
};

export interface BaseFunctionCallOptions extends BaseLanguageModelCallOptions {
  function_call?: FunctionCallOption;
  functions?: FunctionDefinition[];
}

export type BaseLanguageModelInput =
  | BasePromptValueInterface
  | string
  | BaseMessageLike[];

export type StructuredOutputType = InferInteropZodOutput<InteropZodObject>;

export type StructuredOutputMethodOptions<IncludeRaw extends boolean = false> =
  {
    name?: string;
    method?: "functionCalling" | "jsonMode" | "jsonSchema" | string;
    includeRaw?: IncludeRaw;
    /** Whether to use strict mode. Currently only supported by OpenAI models. */
    strict?: boolean;
  };

/** @deprecated Use StructuredOutputMethodOptions instead */
export type StructuredOutputMethodParams<
  RunOutput,
  IncludeRaw extends boolean = false
> = {
  /** @deprecated Pass schema in as the first argument */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: InteropZodType<RunOutput> | Record<string, any>;
  name?: string;
  method?: "functionCalling" | "jsonMode";
  includeRaw?: IncludeRaw;
};

export interface BaseLanguageModelInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
> extends RunnableInterface<BaseLanguageModelInput, RunOutput, CallOptions> {
  get callKeys(): string[];

  generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult>;

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   */
  predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string>;

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   */
  predictMessages(
    messages: BaseMessage[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage>;

  _modelType(): string;

  _llmType(): string;

  getNumTokens(content: MessageContent): Promise<number>;

  /**
   * Get the identifying parameters of the LLM.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any>;

  serialize(): SerializedLLM;
}

export type LanguageModelOutput = BaseMessage | string;

export type LanguageModelLike = Runnable<
  BaseLanguageModelInput,
  LanguageModelOutput
>;

/**
 * Base class for language models.
 */
export abstract class BaseLanguageModel<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput = any,
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends BaseLangChain<BaseLanguageModelInput, RunOutput, CallOptions>
  implements
    BaseLanguageModelParams,
    BaseLanguageModelInterface<RunOutput, CallOptions>
{
  /**
   * Keys that the language model accepts as call options.
   */
  get callKeys(): string[] {
    return ["stop", "timeout", "signal", "tags", "metadata", "callbacks"];
  }

  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  cache?: BaseCache;

  constructor({
    callbacks,
    callbackManager,
    ...params
  }: BaseLanguageModelParams) {
    const { cache, ...rest } = params;
    super({
      callbacks: callbacks ?? callbackManager,
      ...rest,
    });
    if (typeof cache === "object") {
      this.cache = cache;
    } else if (cache) {
      this.cache = InMemoryCache.global();
    } else {
      this.cache = undefined;
    }
    this.caller = new AsyncCaller(params ?? {});
  }

  abstract generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult>;

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   */
  abstract predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string>;

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   */
  abstract predictMessages(
    messages: BaseMessage[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage>;

  abstract _modelType(): string;

  abstract _llmType(): string;

  private _encoding?: Tiktoken;

  /**
   * Get the number of tokens in the content.
   * @param content The content to get the number of tokens for.
   * @returns The number of tokens in the content.
   */
  async getNumTokens(content: MessageContent) {
    // Extract text content from MessageContent
    let textContent: string;
    if (typeof content === "string") {
      textContent = content;
    } else {
      /**
       * Content is an array of MessageContentComplex
       *
       * ToDo(@christian-bromann): This is a temporary fix to get the number of tokens for the content.
       * We need to find a better way to do this.
       * @see https://github.com/langchain-ai/langchainjs/pull/8341#pullrequestreview-2933713116
       */
      textContent = content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item.type === "text" && "text" in item) return item.text;
          return "";
        })
        .join("");
    }

    // fallback to approximate calculation if tiktoken is not available
    let numTokens = Math.ceil(textContent.length / 4);

    if (!this._encoding) {
      try {
        this._encoding = await encodingForModel(
          "modelName" in this
            ? getModelNameForTiktoken(this.modelName as string)
            : "gpt2"
        );
      } catch (error) {
        console.warn(
          "Failed to calculate number of tokens, falling back to approximate count",
          error
        );
      }
    }

    if (this._encoding) {
      try {
        numTokens = this._encoding.encode(textContent).length;
      } catch (error) {
        console.warn(
          "Failed to calculate number of tokens, falling back to approximate count",
          error
        );
      }
    }

    return numTokens;
  }

  protected static _convertInputToPromptValue(
    input: BaseLanguageModelInput
  ): BasePromptValueInterface {
    if (typeof input === "string") {
      return new StringPromptValue(input);
    } else if (Array.isArray(input)) {
      return new ChatPromptValue(input.map(coerceMessageLikeToMessage));
    } else {
      return input;
    }
  }

  /**
   * Get the identifying parameters of the LLM.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any> {
    return {};
  }

  /**
   * Create a unique cache key for a specific call to a specific language model.
   * @param callOptions Call options for the model
   * @returns A unique cache key.
   */
  _getSerializedCacheKeyParametersForCall(
    // TODO: Fix when we remove the RunnableLambda backwards compatibility shim.
    { config, ...callOptions }: CallOptions & { config?: RunnableConfig }
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      ...this._identifyingParams(),
      ...callOptions,
      _type: this._llmType(),
      _model: this._modelType(),
    };
    const filteredEntries = Object.entries(params).filter(
      ([_, value]) => value !== undefined
    );
    const serializedEntries = filteredEntries
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .sort()
      .join(",");
    return serializedEntries;
  }

  /**
   * @deprecated
   * Return a json-like object representing this LLM.
   */
  serialize(): SerializedLLM {
    return {
      ...this._identifyingParams(),
      _type: this._llmType(),
      _model: this._modelType(),
    };
  }

  /**
   * @deprecated
   * Load an LLM from a json-like object describing it.
   */
  static async deserialize(_data: SerializedLLM): Promise<BaseLanguageModel> {
    throw new Error("Use .toJSON() instead");
  }

  withStructuredOutput?<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    schema:
      | ZodTypeV3<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput?<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    schema:
      | ZodTypeV3<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput?<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    schema:
      | ZodTypeV4<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput?<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    schema:
      | ZodTypeV4<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  /**
   * Model wrapper that returns outputs formatted to match the given schema.
   *
   * @template {BaseLanguageModelInput} RunInput The input type for the Runnable, expected to be the same input for the LLM.
   * @template {Record<string, any>} RunOutput The output type for the Runnable, expected to be a Zod schema object for structured output validation.
   *
   * @param {InteropZodType<RunOutput>} schema The schema for the structured output. Either as a Zod schema or a valid JSON schema object.
   *   If a Zod schema is passed, the returned attributes will be validated, whereas with JSON schema they will not be.
   * @param {string} name The name of the function to call.
   * @param {"functionCalling" | "jsonMode"} [method=functionCalling] The method to use for getting the structured output. Defaults to "functionCalling".
   * @param {boolean | undefined} [includeRaw=false] Whether to include the raw output in the result. Defaults to false.
   * @returns {Runnable<RunInput, RunOutput> | Runnable<RunInput, { raw: BaseMessage; parsed: RunOutput }>} A new runnable that calls the LLM with structured output.
   */
  withStructuredOutput?<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    schema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      >;
}

/**
 * Shared interface for token usage
 * return type from LLM calls.
 */
export interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}
