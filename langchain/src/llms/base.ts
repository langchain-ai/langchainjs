import { InMemoryCache } from "../cache/index.js";
import {
  BaseCache,
  BasePromptValue,
  Generation,
  LLMResult,
  RUN_KEY,
} from "../schema/index.js";
import {
  BaseLanguageModel,
  BaseLanguageModelCallOptions,
  BaseLanguageModelParams,
} from "../base_language/index.js";
import {
  CallbackManager,
  CallbackManagerForLLMRun,
  Callbacks,
} from "../callbacks/manager.js";

export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export interface BaseLLMParams extends BaseLanguageModelParams {
  /**
   * @deprecated Use `maxConcurrency` instead
   */
  concurrency?: number;
  cache?: BaseCache | boolean;
}

export interface BaseLLMCallOptions extends BaseLanguageModelCallOptions {}

/**
 * LLM Wrapper. Provides an {@link call} (an {@link generate}) function that takes in a prompt (or prompts) and returns a string.
 */
export abstract class BaseLLM extends BaseLanguageModel {
  declare CallOptions: BaseLLMCallOptions;

  declare ParsedCallOptions: Omit<this["CallOptions"], "timeout">;

  cache?: BaseCache;

  constructor({ cache, concurrency, ...rest }: BaseLLMParams) {
    super(concurrency ? { maxConcurrency: concurrency, ...rest } : rest);
    if (typeof cache === "object") {
      this.cache = cache;
    } else if (cache) {
      this.cache = InMemoryCache.global();
    } else {
      this.cache = undefined;
    }
  }

  async generatePrompt(
    promptValues: BasePromptValue[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const prompts: string[] = promptValues.map((promptValue) =>
      promptValue.toString()
    );
    return this.generate(prompts, options, callbacks);
  }

  /**
   * Run the LLM on the given prompts and input.
   */
  abstract _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult>;

  /** @ignore */
  async _generateUncached(
    prompts: string[],
    options: this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const callbackManager_ = await CallbackManager.configure(
      callbacks,
      this.callbacks,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleLLMStart(
      { name: this._llmType() },
      prompts
    );
    let output;
    try {
      output = await this._generate(prompts, options, runManager);
    } catch (err) {
      await runManager?.handleLLMError(err);
      throw err;
    }

    await runManager?.handleLLMEnd(output);
    // This defines RUN_KEY as a non-enumerable property on the output object
    // so that it is not serialized when the output is stringified, and so that
    // it isnt included when listing the keys of the output object.
    Object.defineProperty(output, RUN_KEY, {
      value: runManager ? { runId: runManager?.runId } : undefined,
      configurable: true,
    });
    return output;
  }

  /**
   * Run the LLM on the given propmts an input, handling caching.
   */
  async generate(
    prompts: string[],
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    if (!Array.isArray(prompts)) {
      throw new Error("Argument 'prompts' is expected to be a string[]");
    }

    let parsedOptions: this["CallOptions"];
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as this["ParsedCallOptions"];
    } else if (options?.timeout && !options.signal) {
      parsedOptions = {
        ...options,
        signal: AbortSignal.timeout(options.timeout),
      };
    } else {
      parsedOptions = options ?? {};
    }

    if (!this.cache) {
      return this._generateUncached(prompts, parsedOptions, callbacks);
    }

    const { cache } = this;
    const params = this.serialize();
    params.stop = parsedOptions.stop ?? params.stop;

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
        parsedOptions,
        callbacks
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
    options?: string[] | this["CallOptions"],
    callbacks?: Callbacks
  ) {
    const { generations } = await this.generate(
      [prompt],
      options ?? {},
      callbacks
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
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string>;

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const generations: Generation[][] = await Promise.all(
      prompts.map((prompt) =>
        this._call(prompt, options, runManager).then((text) => [{ text }])
      )
    );
    return { generations };
  }
}
