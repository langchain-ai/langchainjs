import type { Tiktoken, TiktokenModel } from "js-tiktoken/lite";

import { type BaseCache, InMemoryCache } from "../caches.js";
import {
  type BasePromptValueInterface,
  StringPromptValue,
  ChatPromptValue,
} from "../prompt_values.js";
import {
  type BaseMessage,
  type BaseMessageLike,
  type MessageContent,
  coerceMessageLikeToMessage,
} from "../messages/index.js";
import { type LLMResult } from "../outputs.js";
import {
  BaseCallbackConfig,
  CallbackManager,
  Callbacks,
} from "../callbacks/manager.js";
import { AsyncCaller, AsyncCallerParams } from "../utils/async_caller.js";
import { encodingForModel } from "../utils/tiktoken.js";
import { Runnable, type RunnableInterface } from "../runnables/base.js";
import { RunnableConfig } from "../runnables/config.js";

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

export interface BaseLanguageModelCallOptions extends BaseCallbackConfig {
  /**
   * Stop tokens to use for this call.
   * If not provided, the default stop tokens for the model will be used.
   */
  stop?: string[];

  /**
   * Timeout for this call in milliseconds.
   */
  timeout?: number;

  /**
   * Abort signal for this call.
   * If provided, the call will be aborted when the signal is aborted.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
   */
  signal?: AbortSignal;
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
  parameters: Record<string, unknown>;

  /**
   * A description of what the function does, used by the model to choose when and
   * how to call the function.
   */
  description?: string;
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

export interface BaseLanguageModelInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
> extends RunnableInterface<BaseLanguageModelInput, RunOutput, CallOptions> {
  CallOptions: CallOptions;

  get callKeys(): string[];

  generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult>;

  predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string>;

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
  declare CallOptions: CallOptions;

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
    super({
      callbacks: callbacks ?? callbackManager,
      ...params,
    });
    if (typeof params.cache === "object") {
      this.cache = params.cache;
    } else if (params.cache) {
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

  abstract predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string>;

  abstract predictMessages(
    messages: BaseMessage[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage>;

  abstract _modelType(): string;

  abstract _llmType(): string;

  private _encoding?: Tiktoken;

  async getNumTokens(content: MessageContent) {
    // TODO: Figure out correct value.
    if (typeof content !== "string") {
      return 0;
    }
    // fallback to approximate calculation if tiktoken is not available
    let numTokens = Math.ceil(content.length / 4);

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
        numTokens = this._encoding.encode(content).length;
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
  protected _getSerializedCacheKeyParametersForCall(
    callOptions: CallOptions
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
}
