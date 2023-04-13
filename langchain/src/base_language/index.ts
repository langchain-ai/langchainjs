import type { Tiktoken } from "@dqbd/tiktoken";
import { BasePromptValue, LLMResult } from "../schema/index.js";
import { CallbackManager, getCallbackManager } from "../callbacks/index.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getModelNameForTiktoken, importTiktoken } from "./count_tokens.js";

const getVerbosity = () => false;

export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

/**
 * Base interface for language model parameters.
 * A subclass of {@link BaseLanguageModel} should have a constructor that
 * takes in a parameter that extends this interface.
 */
export interface BaseLanguageModelParams extends AsyncCallerParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

/**
 * Base class for language models.
 */
export abstract class BaseLanguageModel implements BaseLanguageModelParams {
  /**
   * Whether to print out response text.
   */
  verbose: boolean;

  callbackManager: CallbackManager;

  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: BaseLanguageModelParams) {
    this.verbose =
      params.verbose ?? (params.callbackManager ? true : getVerbosity());
    this.callbackManager = params.callbackManager ?? getCallbackManager();
    this.caller = new AsyncCaller(params ?? {});
  }

  abstract generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[]
  ): Promise<LLMResult>;

  abstract _modelType(): string;

  abstract _llmType(): string;

  private _encoding?: Tiktoken;

  private _registry?: FinalizationRegistry<Tiktoken>;

  async getNumTokens(text: string) {
    // fallback to approximate calculation if tiktoken is not available
    let numTokens = Math.ceil(text.length / 4);

    try {
      if (!this._encoding) {
        const { encoding_for_model } = await importTiktoken();
        // modelName only exists in openai subclasses, but tiktoken only supports
        // openai tokenisers anyway, so for other subclasses we default to gpt2
        if (encoding_for_model) {
          this._encoding = encoding_for_model(
            "modelName" in this
              ? getModelNameForTiktoken(this.modelName as string)
              : "gpt2"
          );
          // We need to register a finalizer to free the tokenizer when the
          // model is garbage collected.
          this._registry = new FinalizationRegistry((t) => t.free());
          this._registry.register(this, this._encoding);
        }
      }

      if (this._encoding) {
        numTokens = this._encoding.encode(text).length;
      }
    } catch (error) {
      console.warn(
        "Failed to calculate number of tokens with tiktoken, falling back to approximate count",
        error
      );
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
