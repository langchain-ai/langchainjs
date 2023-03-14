import { BasePromptValue, LLMResult } from "../schema/index.js";
import { CallbackManager, getCallbackManager } from "../callbacks/index.js";

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
export interface BaseLanguageModelParams {
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

  protected constructor(params: BaseLanguageModelParams) {
    this.verbose = params.verbose ?? getVerbosity();
    this.callbackManager = params.callbackManager ?? getCallbackManager();
  }

  abstract generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[]
  ): Promise<LLMResult>;

  abstract _modelType(): string;

  abstract getNumTokens(text: string): number;

  /**
   * Return a json-like object representing this LLM.
   */
  serialize(): SerializedLLM {
    throw new Error("Not implemented");
  }

  /**
   * Load an LLM from a json-like object describing it.
   */
  static async deserialize(_data: SerializedLLM): Promise<BaseLanguageModel> {
    throw new Error("Not implemented");
  }
}
