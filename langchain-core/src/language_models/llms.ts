import {
  AIMessage,
  type BaseMessage,
  getBufferString,
} from "../messages/index.js";
import type { BasePromptValueInterface } from "../prompt_values.js";
import {
  type LLMResult,
  RUN_KEY,
  type Generation,
  GenerationChunk,
} from "../outputs.js";
import {
  type BaseCallbackConfig,
  CallbackManager,
  type CallbackManagerForLLMRun,
  type Callbacks,
} from "../callbacks/manager.js";
import {
  BaseLanguageModel,
  type BaseLanguageModelCallOptions,
  type BaseLanguageModelInput,
  type BaseLanguageModelParams,
} from "./base.js";
import type { RunnableConfig } from "../runnables/config.js";
import type { BaseCache } from "../caches/base.js";
import { concat } from "../utils/stream.js";
import { callbackHandlerPrefersStreaming } from "../callbacks/base.js";

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
}

export interface BaseLLMCallOptions extends BaseLanguageModelCallOptions {}

/**
 * LLM Wrapper. Takes in a prompt (or prompts) and returns a string.
 */
export abstract class BaseLLM<
  CallOptions extends BaseLLMCallOptions = BaseLLMCallOptions
> extends BaseLanguageModel<string, CallOptions> {
  // Backwards compatibility since fields have been moved to RunnableConfig
  declare ParsedCallOptions: Omit<
    CallOptions,
    Exclude<keyof RunnableConfig, "signal" | "timeout" | "maxConcurrency">
  >;

  // Only ever instantiated in main LangChain
  lc_namespace = ["langchain", "llms", this._llmType()];

  constructor({ concurrency, ...rest }: BaseLLMParams) {
    super(concurrency ? { maxConcurrency: concurrency, ...rest } : rest);
  }

  /**
   * This method takes an input and options, and returns a string. It
   * converts the input to a prompt value and generates a result based on
   * the prompt.
   * @param input Input for the LLM.
   * @param options Options for the LLM call.
   * @returns A string result based on the prompt.
   */
  async invoke(
    input: BaseLanguageModelInput,
    options?: CallOptions
  ): Promise<string> {
    const promptValue = BaseLLM._convertInputToPromptValue(input);
    const result = await this.generatePrompt(
      [promptValue],
      options,
      options?.callbacks
    );
    return result.generations[0][0].text;
  }

  // eslint-disable-next-line require-yield
  async *_streamResponseChunks(
    _input: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    throw new Error("Not implemented.");
  }

  protected _separateRunnableConfigFromCallOptionsCompat(
    options?: Partial<CallOptions>
  ): [RunnableConfig, this["ParsedCallOptions"]] {
    // For backwards compat, keep `signal` in both runnableConfig and callOptions
    const [runnableConfig, callOptions] =
      super._separateRunnableConfigFromCallOptions(options);
    (callOptions as this["ParsedCallOptions"]).signal = runnableConfig.signal;
    return [runnableConfig, callOptions as this["ParsedCallOptions"]];
  }

  async *_streamIterator(
    input: BaseLanguageModelInput,
    options?: CallOptions
  ): AsyncGenerator<string> {
    // Subclass check required to avoid double callbacks with default implementation
    if (
      this._streamResponseChunks === BaseLLM.prototype._streamResponseChunks
    ) {
      yield this.invoke(input, options);
    } else {
      const prompt = BaseLLM._convertInputToPromptValue(input);
      const [runnableConfig, callOptions] =
        this._separateRunnableConfigFromCallOptionsCompat(options);
      const callbackManager_ = await CallbackManager.configure(
        runnableConfig.callbacks,
        this.callbacks,
        runnableConfig.tags,
        this.tags,
        runnableConfig.metadata,
        this.metadata,
        { verbose: this.verbose }
      );
      const extra = {
        options: callOptions,
        invocation_params: this?.invocationParams(callOptions),
        batch_size: 1,
      };
      const runManagers = await callbackManager_?.handleLLMStart(
        this.toJSON(),
        [prompt.toString()],
        runnableConfig.runId,
        undefined,
        extra,
        undefined,
        undefined,
        runnableConfig.runName
      );
      let generation = new GenerationChunk({
        text: "",
      });
      try {
        for await (const chunk of this._streamResponseChunks(
          prompt.toString(),
          callOptions,
          runManagers?.[0]
        )) {
          if (!generation) {
            generation = chunk;
          } else {
            generation = generation.concat(chunk);
          }
          if (typeof chunk.text === "string") {
            yield chunk.text;
          }
        }
      } catch (err) {
        await Promise.all(
          (runManagers ?? []).map((runManager) =>
            runManager?.handleLLMError(err)
          )
        );
        throw err;
      }
      await Promise.all(
        (runManagers ?? []).map((runManager) =>
          runManager?.handleLLMEnd({
            generations: [[generation]],
          })
        )
      );
    }
  }

  /**
   * This method takes prompt values, options, and callbacks, and generates
   * a result based on the prompts.
   * @param promptValues Prompt values for the LLM.
   * @param options Options for the LLM call.
   * @param callbacks Callbacks for the LLM call.
   * @returns An LLMResult based on the prompts.
   */
  async generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | CallOptions,
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

  /**
   * Get the parameters used to invoke the model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invocationParams(_options?: this["ParsedCallOptions"]): any {
    return {};
  }

  _flattenLLMResult(llmResult: LLMResult): LLMResult[] {
    const llmResults: LLMResult[] = [];

    for (let i = 0; i < llmResult.generations.length; i += 1) {
      const genList = llmResult.generations[i];

      if (i === 0) {
        llmResults.push({
          generations: [genList],
          llmOutput: llmResult.llmOutput,
        });
      } else {
        const llmOutput = llmResult.llmOutput
          ? { ...llmResult.llmOutput, tokenUsage: {} }
          : undefined;

        llmResults.push({
          generations: [genList],
          llmOutput,
        });
      }
    }

    return llmResults;
  }

  /** @ignore */
  async _generateUncached(
    prompts: string[],
    parsedOptions: this["ParsedCallOptions"],
    handledOptions: BaseCallbackConfig,
    startedRunManagers?: CallbackManagerForLLMRun[]
  ): Promise<LLMResult> {
    let runManagers: CallbackManagerForLLMRun[] | undefined;
    if (
      startedRunManagers !== undefined &&
      startedRunManagers.length === prompts.length
    ) {
      runManagers = startedRunManagers;
    } else {
      const callbackManager_ = await CallbackManager.configure(
        handledOptions.callbacks,
        this.callbacks,
        handledOptions.tags,
        this.tags,
        handledOptions.metadata,
        this.metadata,
        { verbose: this.verbose }
      );
      const extra = {
        options: parsedOptions,
        invocation_params: this?.invocationParams(parsedOptions),
        batch_size: prompts.length,
      };
      runManagers = await callbackManager_?.handleLLMStart(
        this.toJSON(),
        prompts,
        handledOptions.runId,
        undefined,
        extra,
        undefined,
        undefined,
        handledOptions?.runName
      );
    }
    // Even if stream is not explicitly called, check if model is implicitly
    // called from streamEvents() or streamLog() to get all streamed events.
    // Bail out if _streamResponseChunks not overridden
    const hasStreamingHandler = !!runManagers?.[0].handlers.find(
      callbackHandlerPrefersStreaming
    );
    let output: LLMResult;
    if (
      hasStreamingHandler &&
      prompts.length === 1 &&
      this._streamResponseChunks !== BaseLLM.prototype._streamResponseChunks
    ) {
      try {
        const stream = await this._streamResponseChunks(
          prompts[0],
          parsedOptions,
          runManagers?.[0]
        );
        let aggregated;
        for await (const chunk of stream) {
          if (aggregated === undefined) {
            aggregated = chunk;
          } else {
            aggregated = concat(aggregated, chunk);
          }
        }
        if (aggregated === undefined) {
          throw new Error("Received empty response from chat model call.");
        }
        output = { generations: [[aggregated]], llmOutput: {} };
        await runManagers?.[0].handleLLMEnd(output);
      } catch (e) {
        await runManagers?.[0].handleLLMError(e);
        throw e;
      }
    } else {
      try {
        output = await this._generate(prompts, parsedOptions, runManagers?.[0]);
      } catch (err) {
        await Promise.all(
          (runManagers ?? []).map((runManager) =>
            runManager?.handleLLMError(err)
          )
        );
        throw err;
      }

      const flattenedOutputs: LLMResult[] = this._flattenLLMResult(output);
      await Promise.all(
        (runManagers ?? []).map((runManager, i) =>
          runManager?.handleLLMEnd(flattenedOutputs[i])
        )
      );
    }
    const runIds = runManagers?.map((manager) => manager.runId) || undefined;
    // This defines RUN_KEY as a non-enumerable property on the output object
    // so that it is not serialized when the output is stringified, and so that
    // it isnt included when listing the keys of the output object.
    Object.defineProperty(output, RUN_KEY, {
      value: runIds ? { runIds } : undefined,
      configurable: true,
    });
    return output;
  }

  async _generateCached({
    prompts,
    cache,
    llmStringKey,
    parsedOptions,
    handledOptions,
    runId,
  }: {
    prompts: string[];
    cache: BaseCache<Generation[]>;
    llmStringKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedOptions: any;
    handledOptions: RunnableConfig;
    runId?: string;
  }): Promise<
    LLMResult & {
      missingPromptIndices: number[];
      startedRunManagers?: CallbackManagerForLLMRun[];
    }
  > {
    const callbackManager_ = await CallbackManager.configure(
      handledOptions.callbacks,
      this.callbacks,
      handledOptions.tags,
      this.tags,
      handledOptions.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: parsedOptions,
      invocation_params: this?.invocationParams(parsedOptions),
      batch_size: prompts.length,
    };
    const runManagers = await callbackManager_?.handleLLMStart(
      this.toJSON(),
      prompts,
      runId,
      undefined,
      extra,
      undefined,
      undefined,
      handledOptions?.runName
    );

    // generate results
    const missingPromptIndices: number[] = [];
    const results = await Promise.allSettled(
      prompts.map(async (prompt, index) => {
        const result = await cache.lookup(prompt, llmStringKey);
        if (result == null) {
          missingPromptIndices.push(index);
        }
        return result;
      })
    );

    // Map run managers to the results before filtering out null results
    // Null results are just absent from the cache.
    const cachedResults = results
      .map((result, index) => ({ result, runManager: runManagers?.[index] }))
      .filter(
        ({ result }) =>
          (result.status === "fulfilled" && result.value != null) ||
          result.status === "rejected"
      );

    // Handle results and call run managers
    const generations: Generation[][] = [];
    await Promise.all(
      cachedResults.map(async ({ result: promiseResult, runManager }, i) => {
        if (promiseResult.status === "fulfilled") {
          const result = promiseResult.value as Generation[];
          generations[i] = result.map((result) => {
            // eslint-disable-next-line no-param-reassign
            result.generationInfo = {
              ...result.generationInfo,
              tokenUsage: {},
            };
            return result;
          });
          if (result.length) {
            await runManager?.handleLLMNewToken(result[0].text);
          }
          return runManager?.handleLLMEnd(
            {
              generations: [result],
            },
            undefined,
            undefined,
            undefined,
            {
              cached: true,
            }
          );
        } else {
          // status === "rejected"
          await runManager?.handleLLMError(
            promiseResult.reason,
            undefined,
            undefined,
            undefined,
            {
              cached: true,
            }
          );
          return Promise.reject(promiseResult.reason);
        }
      })
    );

    const output = {
      generations,
      missingPromptIndices,
      startedRunManagers: runManagers,
    };

    // This defines RUN_KEY as a non-enumerable property on the output object
    // so that it is not serialized when the output is stringified, and so that
    // it isnt included when listing the keys of the output object.
    Object.defineProperty(output, RUN_KEY, {
      value: runManagers
        ? { runIds: runManagers?.map((manager) => manager.runId) }
        : undefined,
      configurable: true,
    });

    return output;
  }

  /**
   * Run the LLM on the given prompts and input, handling caching.
   */
  async generate(
    prompts: string[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    if (!Array.isArray(prompts)) {
      throw new Error("Argument 'prompts' is expected to be a string[]");
    }

    let parsedOptions: CallOptions | undefined;
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as CallOptions;
    } else {
      parsedOptions = options;
    }

    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptionsCompat(parsedOptions);
    runnableConfig.callbacks = runnableConfig.callbacks ?? callbacks;

    if (!this.cache) {
      return this._generateUncached(prompts, callOptions, runnableConfig);
    }

    const { cache } = this;
    const llmStringKey = this._getSerializedCacheKeyParametersForCall(
      callOptions as CallOptions
    );
    const { generations, missingPromptIndices, startedRunManagers } =
      await this._generateCached({
        prompts,
        cache,
        llmStringKey,
        parsedOptions: callOptions,
        handledOptions: runnableConfig,
        runId: runnableConfig.runId,
      });

    let llmOutput = {};
    if (missingPromptIndices.length > 0) {
      const results = await this._generateUncached(
        missingPromptIndices.map((i) => prompts[i]),
        callOptions,
        runnableConfig,
        startedRunManagers !== undefined
          ? missingPromptIndices.map((i) => startedRunManagers?.[i])
          : undefined
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
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   * Convenience wrapper for {@link generate} that takes in a single string prompt and returns a single string output.
   */
  async call(
    prompt: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string> {
    const { generations } = await this.generate([prompt], options, callbacks);
    return generations[0][0].text;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * This method is similar to `call`, but it's used for making predictions
   * based on the input text.
   * @param text Input text for the prediction.
   * @param options Options for the LLM call.
   * @param callbacks Callbacks for the LLM call.
   * @returns A prediction based on the input text.
   */
  async predict(
    text: string,
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<string> {
    return this.call(text, options, callbacks);
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * This method takes a list of messages, options, and callbacks, and
   * returns a predicted message.
   * @param messages A list of messages for the prediction.
   * @param options Options for the LLM call.
   * @param callbacks Callbacks for the LLM call.
   * @returns A predicted message based on the list of messages.
   */
  async predictMessages(
    messages: BaseMessage[],
    options?: string[] | CallOptions,
    callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const text = getBufferString(messages);
    const prediction = await this.call(text, options, callbacks);
    return new AIMessage(prediction);
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

  _modelType(): string {
    return "base_llm" as const;
  }
}

/**
 * LLM class that provides a simpler interface to subclass than {@link BaseLLM}.
 *
 * Requires only implementing a simpler {@link _call} method instead of {@link _generate}.
 *
 * @augments BaseLLM
 */
export abstract class LLM<
  CallOptions extends BaseLLMCallOptions = BaseLLMCallOptions
> extends BaseLLM<CallOptions> {
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
      prompts.map((prompt, promptIndex) =>
        this._call(prompt, { ...options, promptIndex }, runManager).then(
          (text) => [{ text }]
        )
      )
    );
    return { generations };
  }
}
