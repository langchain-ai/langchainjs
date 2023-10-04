import { type Tiktoken } from "js-tiktoken/lite";
import type { OpenAI as OpenAIClient } from "openai";

import {
  BaseCache,
  BaseMessage,
  BaseMessageLike,
  BasePromptValue,
  LLMResult,
  coerceMessageLikeToMessage,
} from "../schema/index.js";
import {
  BaseCallbackConfig,
  CallbackManager,
  Callbacks,
} from "../callbacks/manager.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getModelNameForTiktoken } from "./count_tokens.js";
import { encodingForModel } from "../util/tiktoken.js";
import { Runnable } from "../schema/runnable/index.js";
import { RunnableConfig } from "../schema/runnable/config.js";
import { StringPromptValue } from "../prompts/base.js";
import { ChatPromptValue } from "../prompts/chat.js";
import { InMemoryCache } from "../cache/index.js";

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

export interface BaseFunctionCallOptions extends BaseLanguageModelCallOptions {
  function_call?: OpenAIClient.Chat.ChatCompletionCreateParams.FunctionCallOption;
  functions?: OpenAIClient.Chat.ChatCompletionCreateParams.Function[];
}

export type BaseLanguageModelInput =
  | BasePromptValue
  | string
  | BaseMessageLike[];

/**
 * Base class for language models.
 */
export abstract class BaseLanguageModel<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput = any,
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends BaseLangChain<BaseLanguageModelInput, RunOutput, CallOptions>
  implements BaseLanguageModelParams
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
    promptValues: BasePromptValue[],
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

  async getNumTokens(text: string) {
    // fallback to approximate calculation if tiktoken is not available
    let numTokens = Math.ceil(text.length / 4);

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
      numTokens = this._encoding.encode(text).length;
    }

    return numTokens;
  }

  protected static _convertInputToPromptValue(
    input: BaseLanguageModelInput
  ): BasePromptValue {
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
  static async deserialize(data: SerializedLLM): Promise<BaseLanguageModel> {
    const { _type, _model, ...rest } = data;
    if (_model && _model !== "base_chat_model") {
      throw new Error(`Cannot load LLM with model ${_model}`);
    }
    const Cls = {
      openai: (await import("../chat_models/openai.js")).ChatOpenAI,
    }[_type];
    if (Cls === undefined) {
      throw new Error(`Cannot load LLM with type ${_type}`);
    }
    return new Cls(rest);
  }
}

/*
 * Export utility functions for token calculations:
 * - calculateMaxTokens: Calculate max tokens for a given model and prompt (the model context size - tokens in prompt).
 * - getModelContextSize: Get the context size for a specific model.
 */
export { calculateMaxTokens, getModelContextSize } from "./count_tokens.js";
