import GPT3Tokenizer from "gpt3-tokenizer";
import PQueue from "p-queue";

import { BaseCache, InMemoryCache } from "../cache.js";
import { BasePromptValue, LLMResult } from "../schema/index.js";
import {
  BaseLanguageModel,
  BaseLanguageModelParams,
} from "../base_language/index.js";
import { CallbackManager } from "../callbacks/index.js";

export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export interface BaseLLMParams extends BaseLanguageModelParams {
  concurrency?: number;
  cache?: BaseCache | boolean;
}

/**
 * LLM Wrapper. Provides an {@link call} (an {@link generate}) function that takes in a prompt (or prompts) and returns a string.
 */
export abstract class BaseLLM extends BaseLanguageModel {
  /**
   * The name of the LLM class
   */
  name: string;

  cache?: BaseCache;

  /**
   * Maximum number of concurrent calls to this chain,
   * additional calls are queued up. Defaults to Infinity.
   */
  concurrency?: number;

  protected queue: PQueue;

  constructor({ concurrency, cache, ...rest }: BaseLLMParams) {
    super(rest);
    if (cache instanceof BaseCache) {
      this.cache = cache;
    } else if (cache) {
      this.cache = InMemoryCache.global();
    } else {
      this.cache = undefined;
    }
    this.concurrency = concurrency ?? Infinity;
    this.queue = new PQueue({ concurrency: this.concurrency });
  }

  async generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[]
  ): Promise<LLMResult> {
    const prompts: string[] = promptValues.map((promptValue) =>
      promptValue.toString()
    );
    return this.generate(prompts, stop);
  }

  /**
   * Run the LLM on the given prompts and input.
   */
  abstract _generate(
    prompts: string[],
    stop?: string[],
    callbackManager?: CallbackManager,
    runId?: string
  ): Promise<LLMResult>;

  /** @ignore */
  async _generateUncached(
    prompts: string[],
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<LLMResult> {
    const callbackManager_ = callbackManager ?? this.callbackManager;
    const runId = await callbackManager_.handleLLMStart(
      { name: this._llmType() },
      prompts,
      undefined,
      this.verbose
    );
    let output;
    try {
      output = await this.queue.add(
        () => this._generate(prompts, stop, callbackManager, runId),
        {
          throwOnTimeout: true,
        }
      );
    } catch (err) {
      await callbackManager_.handleLLMError(err, runId, this.verbose);
      throw err;
    }

    await callbackManager_.handleLLMEnd(output, runId, this.verbose);
    if (output.llmOutput) {
      output.llmOutput = {
        ...output.llmOutput,
        ...{ runId },
      };
    } else {
      output.llmOutput = { runId };
    }
    return output;
  }

  /**
   * Run the LLM on the given propmts an input, handling caching.
   */
  async generate(
    prompts: string[],
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<LLMResult> {
    if (!Array.isArray(prompts)) {
      throw new Error("Argument 'prompts' is expected to be a string[]");
    }

    if (!this.cache) {
      return this._generateUncached(prompts, stop, callbackManager);
    }

    const { cache } = this;
    const params = this.serialize();
    params.stop = stop;

    const llmStringKey = `${Object.entries(params).sort()}`;
    const missingPromptIndices: number[] = [];
    const generations = await Promise.all(
      prompts.map(async (prompt, index) => {
        const result = await cache.lookup(prompt, llmStringKey);
        if (!result) {
          missingPromptIndices.push(index);
        }
        return result;
      })
    );

    let llmOutput = {};
    if (missingPromptIndices.length > 0) {
      const results = await this._generateUncached(
        missingPromptIndices.map((i) => prompts[i]),
        stop,
        callbackManager
      );
      await Promise.all(
        results.generations.map(async (generation, index) => {
          const promptIndex = missingPromptIndices[index];
          generations[promptIndex] = generation;
          return cache.update(prompts[promptIndex], llmStringKey, generation);
        })
      );
      llmOutput = results.llmOutput ?? {};
    }

    return { generations, llmOutput } as LLMResult;
  }

  /**
   * Convenience wrapper for {@link generate} that takes in a single string prompt and returns a single string output.
   */
  async call(
    prompt: string,
    stop?: string[],
    callbackManager?: CallbackManager
  ) {
    const { generations } = await this.generate(
      [prompt],
      stop,
      callbackManager
    );
    return generations[0][0].text;
  }

  /**
   * Get the identifying parameters of the LLM.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any> {
    return {};
  }

  /**
   * Return the string type key uniquely identifying this class of LLM.
   */
  abstract _llmType(): string;

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

  _modelType(): string {
    return "base_llm" as const;
  }

  /**
   * Load an LLM from a json-like object describing it.
   */
  static async deserialize(data: SerializedLLM): Promise<BaseLLM> {
    const { _type, _model, ...rest } = data;
    if (_model && _model !== "base_llm") {
      throw new Error(`Cannot load LLM with model ${_model}`);
    }
    const Cls = {
      openai: (await import("./openai.js")).OpenAI,
    }[_type];
    if (Cls === undefined) {
      throw new Error(`Cannot load  LLM with type ${_type}`);
    }
    return new Cls(rest);
  }

  private _tokenizer?: GPT3Tokenizer.default;

  getNumTokens(text: string): number {
    // TODOs copied from py implementation
    // TODO: this method may not be exact.
    // TODO: this method may differ based on model (eg codex, gpt-3.5).
    if (this._tokenizer === undefined) {
      const Constructor = GPT3Tokenizer.default;
      this._tokenizer = new Constructor({ type: "gpt3" });
    }
    return this._tokenizer.encode(text).bpe.length;
  }

  // TODO(sean): save to disk
}

/**
 * LLM class that provides a simpler interface to subclass than {@link BaseLLM}.
 *
 * Requires only implementing a simpler {@link _call} method instead of {@link _generate}.
 *
 * @augments BaseLLM
 */
export abstract class LLM extends BaseLLM {
  /**
   * Run the LLM on the given prompt and input.
   */
  abstract _call(
    prompt: string,
    stop?: string[],
    callbackManager?: CallbackManager,
    runId?: string
  ): Promise<string>;

  async _generate(
    prompts: string[],
    stop?: string[],
    callbackManager?: CallbackManager,
    runId?: string
  ): Promise<LLMResult> {
    const generations = [];
    for (let i = 0; i < prompts.length; i += 1) {
      const text = await this.queue.add(
        () => this._call(prompts[i], stop, callbackManager, runId),
        {
          throwOnTimeout: true,
        }
      );
      generations.push([{ text }]);
    }
    return { generations };
  }
}
