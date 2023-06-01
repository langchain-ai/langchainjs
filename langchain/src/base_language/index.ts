import { type Tiktoken } from "js-tiktoken/lite";
import {
  BaseChatMessage,
  BasePromptValue,
  LLMResult,
} from "../schema/index.js";
import { CallbackManager, Callbacks } from "../callbacks/manager.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getModelNameForTiktoken } from "./count_tokens.js";
import { encodingForModel } from "../util/tiktoken.js";
import { Serializable } from "../schema/load.js";

const getVerbosity = () => false;

export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export interface BaseLangChainParams {
  verbose?: boolean;
  callbacks?: Callbacks;
}

/**
 * Base class for language models, chains, tools.
 */
export abstract class BaseLangChain
  extends Serializable
  implements BaseLangChainParams
{
  /**
   * Whether to print out response text.
   */
  verbose: boolean;

  callbacks?: Callbacks;

  constructor(params: BaseLangChainParams, ...args: unknown[]) {
    super(params, ...args);
    this.verbose = params.verbose ?? getVerbosity();
    this.callbacks = params.callbacks;
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
}

export interface BaseLanguageModelCallOptions {
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
   */
  signal?: AbortSignal;
}

/**
 * Base class for language models.
 */
export abstract class BaseLanguageModel
  extends BaseLangChain
  implements BaseLanguageModelParams
{
  declare CallOptions: BaseLanguageModelCallOptions;

  /**
   * Keys that the language model accepts as call options.
   */
  get callKeys(): string[] {
    return ["stop", "timeout", "signal"];
  }

  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor({
    callbacks,
    callbackManager,
    ...params
  }: BaseLanguageModelParams) {
    super({
      callbacks: callbacks ?? callbackManager,
      ...params,
    });
    this.caller = new AsyncCaller(params ?? {});
  }

  abstract generatePrompt(
    promptValues: BasePromptValue[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult>;

  abstract predict(
    text: string,
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<string>;

  abstract predictMessages(
    messages: BaseChatMessage[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<BaseChatMessage>;

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

  /**
   * Get the identifying parameters of the LLM.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any> {
    return {};
  }

  /**
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
      throw new Error(`Cannot load  LLM with type ${_type}`);
    }
    return new Cls(rest);
  }
}

/*
 * Calculate max tokens for given model and prompt.
 * That is the model size - number of tokens in prompt.
 */
export { calculateMaxTokens } from "./count_tokens.js";
