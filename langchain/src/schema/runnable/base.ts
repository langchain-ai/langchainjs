import pRetry from "p-retry";

import {
  CallbackManager,
  CallbackManagerForChainRun,
  BaseCallbackConfig,
} from "../../callbacks/manager.js";
import { Serializable } from "../../load/serializable.js";
import { IterableReadableStream } from "../../util/stream.js";
import { RunnableConfig, getCallbackMangerForConfig } from "./config.js";
import { AsyncCaller } from "../../util/async_caller.js";

export type RunnableFunc<RunInput, RunOutput> = (
  input: RunInput
) => RunOutput | Promise<RunOutput>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableLike<RunInput = any, RunOutput = any> =
  | Runnable<RunInput, RunOutput>
  | RunnableFunc<RunInput, RunOutput>
  | { [key: string]: RunnableLike<RunInput, RunOutput> };

export type RunnableBatchOptions = {
  maxConcurrency?: number;
  returnExceptions?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableRetryFailedAttemptHandler = (error: any) => any;

type RunnableConfigAndOptions = RunnableConfig & { runType?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _coerceToDict(value: any, defaultKey: string) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value
    : { [defaultKey]: value };
}

/**
 * A Runnable is a generic unit of work that can be invoked, batched, streamed, and/or
 * transformed.
 */
export abstract class Runnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Serializable {
  protected lc_runnable = true;

  abstract invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput>;

  /**
   * Bind arguments to a Runnable, returning a new Runnable.
   * @param kwargs
   * @returns A new RunnableBinding that, when invoked, will apply the bound args.
   */
  bind(
    kwargs: Partial<CallOptions>
  ): Runnable<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBinding({ bound: this, kwargs, config: {} });
  }

  /**
   * Return a new Runnable that maps a list of inputs to a list of outputs,
   * by calling invoke() with each input.
   */
  map(): Runnable<RunInput[], RunOutput[], CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableEach({ bound: this });
  }

  /**
   * Add retry logic to an existing runnable.
   * @param kwargs
   * @returns A new RunnableRetry that, when invoked, will retry according to the parameters.
   */
  withRetry(fields?: {
    stopAfterAttempt?: number;
    onFailedAttempt?: RunnableRetryFailedAttemptHandler;
  }): RunnableRetry<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableRetry({
      bound: this,
      kwargs: {},
      config: {},
      maxAttemptNumber: fields?.stopAfterAttempt,
      ...fields,
    });
  }

  /**
   * Bind config to a Runnable, returning a new Runnable.
   * @param config New configuration parameters to attach to the new runnable.
   * @returns A new RunnableBinding with a config matching what's passed.
   */
  withConfig(
    config: RunnableConfig
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBinding({
      bound: this,
      config,
      kwargs: {},
    });
  }

  /**
   * Create a new runnable from the current one that will try invoking
   * other passed fallback runnables if the initial invocation fails.
   * @param fields.fallbacks Other runnables to call if the runnable errors.
   * @returns A new RunnableWithFallbacks.
   */
  withFallbacks(fields: {
    fallbacks: Runnable<RunInput, RunOutput>[];
  }): RunnableWithFallbacks<RunInput, RunOutput> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableWithFallbacks<RunInput, RunOutput>({
      runnable: this,
      fallbacks: fields.fallbacks,
    });
  }

  protected _getOptionsList(
    options: Partial<CallOptions> | Partial<CallOptions>[],
    length = 0
  ): Partial<CallOptions>[] {
    if (Array.isArray(options)) {
      if (options.length !== length) {
        throw new Error(
          `Passed "options" must be an array with the same length as the inputs, but got ${options.length} options for ${length} inputs`
        );
      }
      return options;
    }
    return Array.from({ length }, () => options);
  }

  /**
   * Default implementation of batch, which calls invoke N times.
   * Subclasses should override this method if they can batch more efficiently.
   * @param inputs Array of inputs to each batch call.
   * @param options Either a single call options object to apply to each batch call or an array for each call.
   * @param batchOptions.maxConcurrency Maximum number of calls to run at once.
   * @param batchOptions.returnExceptions Whether to return errors rather than throwing on the first one
   * @returns An array of RunOutputs, or mixed RunOutputs and errors if batchOptions.returnExceptions is set
   */
  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    const configList = this._getOptionsList(options ?? {}, inputs.length);
    const caller = new AsyncCaller({
      maxConcurrency: batchOptions?.maxConcurrency,
      onFailedAttempt: (e) => {
        throw e;
      },
    });
    const batchCalls = inputs.map((input, i) =>
      caller.call(async () => {
        try {
          const result = await this.invoke(input, configList[i]);
          return result;
        } catch (e) {
          if (batchOptions?.returnExceptions) {
            return e as Error;
          }
          throw e;
        }
      })
    );
    return Promise.all(batchCalls);
  }

  /**
   * Default streaming implementation.
   * Subclasses should override this method if they support streaming output.
   * @param input
   * @param options
   */
  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    yield this.invoke(input, options);
  }

  /**
   * Stream output in chunks.
   * @param input
   * @param options
   * @returns A readable stream that is also an iterable.
   */
  async stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStream<RunOutput>> {
    return IterableReadableStream.fromAsyncGenerator(
      this._streamIterator(input, options)
    );
  }

  protected _separateRunnableConfigFromCallOptions(
    options: Partial<CallOptions> = {}
  ): [RunnableConfig, Omit<Partial<CallOptions>, keyof RunnableConfig>] {
    const runnableConfig: RunnableConfig = {
      callbacks: options.callbacks,
      tags: options.tags,
      metadata: options.metadata,
    };
    const callOptions = { ...options };
    delete callOptions.callbacks;
    delete callOptions.tags;
    delete callOptions.metadata;
    return [runnableConfig, callOptions];
  }

  protected async _callWithConfig<T extends RunInput>(
    func:
      | ((input: T) => Promise<RunOutput>)
      | ((
          input: T,
          config?: RunnableConfig,
          runManager?: CallbackManagerForChainRun
        ) => Promise<RunOutput>),
    input: T,
    options?: RunnableConfigAndOptions
  ) {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      undefined,
      options?.runType
    );
    let output;
    try {
      output = await func.bind(this)(input, options, runManager);
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(output, "output"));
    return output;
  }

  /**
   * Internal method that handles batching and configuration for a runnable
   * It takes a function, input values, and optional configuration, and
   * returns a promise that resolves to the output values.
   * @param func The function to be executed for each input value.
   * @param input The input values to be processed.
   * @param config Optional configuration for the function execution.
   * @returns A promise that resolves to the output values.
   */
  async _batchWithConfig<T extends RunInput>(
    func: (
      inputs: T[],
      configs?: RunnableConfig[],
      runManagers?: (CallbackManagerForChainRun | undefined)[],
      batchOptions?: RunnableBatchOptions
    ) => Promise<(RunOutput | Error)[]>,
    inputs: T[],
    options?:
      | Partial<RunnableConfigAndOptions>
      | Partial<RunnableConfigAndOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    const configs = this._getOptionsList(
      (options ?? {}) as CallOptions,
      inputs.length
    );
    const callbackManagers = await Promise.all(
      configs.map(getCallbackMangerForConfig)
    );
    const runManagers = await Promise.all(
      callbackManagers.map((callbackManager, i) =>
        callbackManager?.handleChainStart(
          this.toJSON(),
          _coerceToDict(inputs[i], "input")
        )
      )
    );
    let outputs: (RunOutput | Error)[];
    try {
      outputs = await func(inputs, configs, runManagers, batchOptions);
    } catch (e) {
      await Promise.all(
        runManagers.map((runManager) => runManager?.handleChainError(e))
      );
      throw e;
    }
    await Promise.all(
      runManagers.map((runManager) =>
        runManager?.handleChainEnd(_coerceToDict(outputs, "output"))
      )
    );
    return outputs;
  }

  /**
   * Helper method to transform an Iterator of Input values into an Iterator of
   * Output values, with callbacks.
   * Use this to implement `stream()` or `transform()` in Runnable subclasses.
   */
  protected async *_transformStreamWithConfig<
    I extends RunInput,
    O extends RunOutput
  >(
    inputGenerator: AsyncGenerator<I>,
    transformer: (
      generator: AsyncGenerator<I>,
      runManager?: CallbackManagerForChainRun,
      options?: Partial<RunnableConfig>
    ) => AsyncGenerator<O>,
    options?: RunnableConfig & { runType?: string }
  ): AsyncGenerator<O> {
    let finalInput: I | undefined;
    let finalInputSupported = true;
    let finalOutput: O | undefined;
    let finalOutputSupported = true;

    const callbackManager_ = await getCallbackMangerForConfig(options);
    let runManager: CallbackManagerForChainRun | undefined;
    const serializedRepresentation = this.toJSON();
    async function* wrapInputForTracing() {
      for await (const chunk of inputGenerator) {
        if (!runManager) {
          // Start the run manager AFTER the iterator starts to preserve
          // tracing order
          runManager = await callbackManager_?.handleChainStart(
            serializedRepresentation,
            { input: "" },
            undefined,
            options?.runType
          );
        }
        if (finalInputSupported) {
          if (finalInput === undefined) {
            finalInput = chunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              finalInput = (finalInput as any).concat(chunk);
            } catch {
              finalInput = undefined;
              finalInputSupported = false;
            }
          }
        }
        yield chunk;
      }
    }

    const wrappedInputGenerator = wrapInputForTracing();
    try {
      const outputIterator = transformer(
        wrappedInputGenerator,
        runManager,
        options
      );
      for await (const chunk of outputIterator) {
        yield chunk;
        if (finalOutputSupported) {
          if (finalOutput === undefined) {
            finalOutput = chunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              finalOutput = (finalOutput as any).concat(chunk);
            } catch {
              finalOutput = undefined;
              finalOutputSupported = false;
            }
          }
        }
      }
    } catch (e) {
      await runManager?.handleChainError(e, undefined, undefined, undefined, {
        inputs: _coerceToDict(finalInput, "input"),
      });
      throw e;
    }
    await runManager?.handleChainEnd(
      finalOutput ?? {},
      undefined,
      undefined,
      undefined,
      { inputs: _coerceToDict(finalInput, "input") }
    );
  }

  _patchConfig(
    config: Partial<CallOptions> = {},
    callbackManager: CallbackManager | undefined = undefined
  ): Partial<CallOptions> {
    return { ...config, callbacks: callbackManager };
  }

  /**
   * Create a new runnable sequence that runs each individual runnable in series,
   * piping the output of one runnable into another runnable or runnable-like.
   * @param coerceable A runnable, function, or object whose values are functions or runnables.
   * @returns A new runnable sequence.
   */
  pipe<NewRunOutput>(
    coerceable: RunnableLike<RunOutput, NewRunOutput>
  ): RunnableSequence<RunInput, Exclude<NewRunOutput, Error>> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableSequence({
      first: this,
      last: _coerceToRunnable(coerceable),
    });
  }

  /**
   * Default implementation of transform, which buffers input and then calls stream.
   * Subclasses should override this method if they can start producing output while
   * input is still being generated.
   * @param generator
   * @param options
   */
  async *transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    let finalChunk;
    for await (const chunk of generator) {
      if (!finalChunk) {
        finalChunk = chunk;
      } else {
        // Make a best effort to gather, for any type that supports concat.
        // This method should throw an error if gathering fails.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalChunk = (finalChunk as any).concat(chunk);
      }
    }
    yield* this._streamIterator(finalChunk, options);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isRunnable(thing: any): thing is Runnable {
    return thing.lc_runnable;
  }
}

export type RunnableBindingArgs<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> = {
  bound: Runnable<RunInput, RunOutput, CallOptions>;
  kwargs: Partial<CallOptions>;
  config: RunnableConfig;
};

/**
 * A runnable that delegates calls to another runnable with a set of kwargs.
 */
export class RunnableBinding<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  static lc_name() {
    return "RunnableBinding";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  bound: Runnable<RunInput, RunOutput, CallOptions>;

  config: RunnableConfig;

  protected kwargs: Partial<CallOptions>;

  constructor(fields: RunnableBindingArgs<RunInput, RunOutput, CallOptions>) {
    super(fields);
    this.bound = fields.bound;
    this.kwargs = fields.kwargs;
    this.config = fields.config;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _mergeConfig(options?: Record<string, any>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: Record<string, any> = { ...this.config };
    if (options) {
      for (const key of Object.keys(options)) {
        if (key === "metadata") {
          copy[key] = { ...copy[key], ...options[key] };
        } else if (key === "tags") {
          copy[key] = (copy[key] ?? []).concat(options[key] ?? []);
        } else {
          copy[key] = options[key] ?? copy[key];
        }
      }
    }
    return copy as Partial<CallOptions>;
  }

  bind(
    kwargs: Partial<CallOptions>
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    return this.constructor({
      bound: this.bound,
      kwargs: { ...this.kwargs, ...kwargs },
      config: this.config,
    });
  }

  withConfig(
    config: RunnableConfig
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    return this.constructor({
      bound: this.bound,
      kwargs: this.kwargs,
      config: { ...this.config, ...config },
    });
  }

  withRetry(fields?: {
    stopAfterAttempt?: number;
    onFailedAttempt?: RunnableRetryFailedAttemptHandler;
  }): RunnableRetry<RunInput, RunOutput, CallOptions> {
    return this.constructor({
      bound: this.bound.withRetry(fields),
      kwargs: this.kwargs,
      config: this.config,
    });
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    return this.bound.invoke(
      input,
      this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    const mergedOptions = Array.isArray(options)
      ? options.map((individualOption) =>
          this._mergeConfig({
            ...individualOption,
            ...this.kwargs,
          })
        )
      : this._mergeConfig({ ...options, ...this.kwargs });
    return this.bound.batch(inputs, mergedOptions, batchOptions);
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ) {
    yield* this.bound._streamIterator(
      input,
      this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ): Promise<IterableReadableStream<RunOutput>> {
    return this.bound.stream(
      input,
      this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  async *transform(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    yield* this.bound.transform(
      generator,
      this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  static isRunnableBinding(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thing: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): thing is RunnableBinding<any, any, any> {
    return thing.bound && Runnable.isRunnable(thing.bound);
  }
}

/**
 * A runnable that delegates calls to another runnable
 * with each element of the input sequence.
 */
export class RunnableEach<
  RunInputItem,
  RunOutputItem,
  CallOptions extends BaseCallbackConfig
> extends Runnable<RunInputItem[], RunOutputItem[], CallOptions> {
  static lc_name() {
    return "RunnableEach";
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "schema", "runnable"];

  bound: Runnable<RunInputItem, RunOutputItem, CallOptions>;

  constructor(fields: {
    bound: Runnable<RunInputItem, RunOutputItem, CallOptions>;
  }) {
    super(fields);
    this.bound = fields.bound;
  }

  /**
   * Binds the runnable with the specified arguments.
   * @param args The arguments to bind the runnable with.
   * @returns A new instance of the `RunnableEach` class that is bound with the specified arguments.
   */
  bind(kwargs: Partial<CallOptions>) {
    return new RunnableEach({
      bound: this.bound.bind(kwargs),
    });
  }

  /**
   * Invokes the runnable with the specified input and configuration.
   * @param input The input to invoke the runnable with.
   * @param config The configuration to invoke the runnable with.
   * @returns A promise that resolves to the output of the runnable.
   */
  async invoke(
    inputs: RunInputItem[],
    config?: Partial<CallOptions>
  ): Promise<RunOutputItem[]> {
    return this._callWithConfig(this._invoke, inputs, config);
  }

  /**
   * A helper method that is used to invoke the runnable with the specified input and configuration.
   * @param input The input to invoke the runnable with.
   * @param config The configuration to invoke the runnable with.
   * @returns A promise that resolves to the output of the runnable.
   */
  protected async _invoke(
    inputs: RunInputItem[],
    config?: Partial<CallOptions>,
    runManager?: CallbackManagerForChainRun
  ): Promise<RunOutputItem[]> {
    return this.bound.batch(
      inputs,
      this._patchConfig(config, runManager?.getChild())
    );
  }
}

/**
 * Base class for runnables that can be retried a
 * specified number of times.
 */
export class RunnableRetry<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends RunnableConfig = RunnableConfig
> extends RunnableBinding<RunInput, RunOutput, CallOptions> {
  static lc_name() {
    return "RunnableRetry";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  protected maxAttemptNumber = 3;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFailedAttempt?: RunnableRetryFailedAttemptHandler = () => {};

  constructor(
    fields: RunnableBindingArgs<RunInput, RunOutput, CallOptions> & {
      maxAttemptNumber?: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onFailedAttempt?: RunnableRetryFailedAttemptHandler;
    }
  ) {
    super(fields);
    this.maxAttemptNumber = fields.maxAttemptNumber ?? this.maxAttemptNumber;
    this.onFailedAttempt = fields.onFailedAttempt ?? this.onFailedAttempt;
  }

  _patchConfigForRetry(
    attempt: number,
    config?: Partial<CallOptions>,
    runManager?: CallbackManagerForChainRun
  ): Partial<CallOptions> {
    const tag = attempt > 1 ? `retry:attempt:${attempt}` : undefined;
    return this._patchConfig(config, runManager?.getChild(tag));
  }

  protected async _invoke(
    input: RunInput,
    config?: CallOptions,
    runManager?: CallbackManagerForChainRun
  ): Promise<RunOutput> {
    return pRetry(
      (attemptNumber: number) =>
        super.invoke(
          input,
          this._patchConfigForRetry(attemptNumber, config, runManager)
        ),
      {
        onFailedAttempt: this.onFailedAttempt,
        retries: Math.max(this.maxAttemptNumber - 1, 0),
        randomize: true,
      }
    );
  }

  /**
   * Method that invokes the runnable with the specified input, run manager,
   * and config. It handles the retry logic by catching any errors and
   * recursively invoking itself with the updated config for the next retry
   * attempt.
   * @param input The input for the runnable.
   * @param runManager The run manager for the runnable.
   * @param config The config for the runnable.
   * @returns A promise that resolves to the output of the runnable.
   */
  async invoke(input: RunInput, config?: CallOptions): Promise<RunOutput> {
    return this._callWithConfig(this._invoke, input, config);
  }

  async _batch<ReturnExceptions extends boolean = false>(
    inputs: RunInput[],
    configs?: RunnableConfig[],
    runManagers?: (CallbackManagerForChainRun | undefined)[],
    batchOptions?: RunnableBatchOptions
  ) {
    const resultsMap: Record<string, RunOutput | Error> = {};
    try {
      await pRetry(
        async (attemptNumber: number) => {
          const remainingIndexes = inputs
            .map((_, i) => i)
            .filter(
              (i) =>
                resultsMap[i.toString()] === undefined ||
                // eslint-disable-next-line no-instanceof/no-instanceof
                resultsMap[i.toString()] instanceof Error
            );
          const remainingInputs = remainingIndexes.map((i) => inputs[i]);
          const patchedConfigs = remainingIndexes.map((i) =>
            this._patchConfigForRetry(
              attemptNumber,
              configs?.[i] as CallOptions,
              runManagers?.[i]
            )
          );
          const results = await super.batch(remainingInputs, patchedConfigs, {
            ...batchOptions,
            returnExceptions: true,
          });
          let firstException;
          for (let i = 0; i < results.length; i += 1) {
            const result = results[i];
            const resultMapIndex = remainingIndexes[i];
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (result instanceof Error) {
              if (firstException === undefined) {
                firstException = result;
              }
            }
            resultsMap[resultMapIndex.toString()] = result;
          }
          if (firstException) {
            throw firstException;
          }
          return results;
        },
        {
          onFailedAttempt: this.onFailedAttempt,
          retries: Math.max(this.maxAttemptNumber - 1, 0),
          randomize: true,
        }
      );
    } catch (e) {
      if (batchOptions?.returnExceptions !== true) {
        throw e;
      }
    }
    return Object.keys(resultsMap)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map(
        (key) => resultsMap[parseInt(key, 10)]
      ) as ReturnExceptions extends false ? RunOutput[] : (RunOutput | Error)[];
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    return this._batchWithConfig(
      this._batch.bind(this),
      inputs,
      options,
      batchOptions
    );
  }
}

/**
 * A sequence of runnables, where the output of each is the input of the next.
 */
export class RunnableSequence<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any
> extends Runnable<RunInput, RunOutput> {
  static lc_name() {
    return "RunnableSequence";
  }

  protected first: Runnable<RunInput>;

  protected middle: Runnable[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected last: Runnable<any, RunOutput>;

  lc_serializable = true;

  lc_namespace = ["langchain", "schema", "runnable"];

  constructor(fields: {
    first: Runnable<RunInput>;
    middle?: Runnable[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last: Runnable<any, RunOutput>;
  }) {
    super(fields);
    this.first = fields.first;
    this.middle = fields.middle ?? this.middle;
    this.last = fields.last;
  }

  get steps() {
    return [this.first, ...this.middle, this.last];
  }

  async invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput> {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input")
    );
    let nextStepInput = input;
    let finalOutput: RunOutput;
    try {
      const initialSteps = [this.first, ...this.middle];
      for (let i = 0; i < initialSteps.length; i += 1) {
        const step = initialSteps[i];
        nextStepInput = await step.invoke(
          nextStepInput,
          this._patchConfig(options, runManager?.getChild(`seq:step:${i + 1}`))
        );
      }
      // TypeScript can't detect that the last output of the sequence returns RunOutput, so call it out of the loop here
      finalOutput = await this.last.invoke(
        nextStepInput,
        this._patchConfig(
          options,
          runManager?.getChild(`seq:step:${this.steps.length}`)
        )
      );
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(finalOutput, "output"));
    return finalOutput;
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    const configList = this._getOptionsList(options ?? {}, inputs.length);
    const callbackManagers = await Promise.all(
      configList.map(getCallbackMangerForConfig)
    );
    const runManagers = await Promise.all(
      callbackManagers.map((callbackManager, i) =>
        callbackManager?.handleChainStart(
          this.toJSON(),
          _coerceToDict(inputs[i], "input")
        )
      )
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nextStepInputs: any = inputs;
    let finalOutputs: (RunOutput | Error)[];
    try {
      const initialSteps = [this.first, ...this.middle];
      for (let i = 0; i < initialSteps.length; i += 1) {
        const step = initialSteps[i];
        nextStepInputs = await step.batch(
          nextStepInputs,
          runManagers.map((runManager, j) =>
            this._patchConfig(
              configList[j],
              runManager?.getChild(`seq:step:${i + 1}`)
            )
          ),
          batchOptions
        );
      }
      finalOutputs = await this.last.batch(
        nextStepInputs,
        runManagers.map((runManager) =>
          this._patchConfig(
            configList[this.steps.length - 1],
            runManager?.getChild(`seq:step:${this.steps.length}`)
          )
        ),
        batchOptions
      );
    } catch (e) {
      await Promise.all(
        runManagers.map((runManager) => runManager?.handleChainError(e))
      );
      throw e;
    }
    await Promise.all(
      runManagers.map((runManager, i) =>
        runManager?.handleChainEnd(_coerceToDict(finalOutputs[i], "output"))
      )
    );
    return finalOutputs;
  }

  async *_streamIterator(
    input: RunInput,
    options?: RunnableConfig
  ): AsyncGenerator<RunOutput> {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input")
    );
    let nextStepInput = input;
    const steps = [this.first, ...this.middle, this.last];
    // Find the index of the last runnable in the sequence that doesn't have an overridden .transform() method
    // and start streaming from there
    const streamingStartStepIndex = Math.min(
      steps.length - 1,
      steps.length -
        [...steps].reverse().findIndex((step) => {
          const isDefaultImplementation =
            step.transform === Runnable.prototype.transform;
          const boundRunnableIsDefaultImplementation =
            RunnableBinding.isRunnableBinding(step) &&
            step.bound?.transform === Runnable.prototype.transform;
          return (
            isDefaultImplementation || boundRunnableIsDefaultImplementation
          );
        }) -
        1
    );

    try {
      const invokeSteps = steps.slice(0, streamingStartStepIndex);
      for (let i = 0; i < invokeSteps.length; i += 1) {
        const step = invokeSteps[i];
        nextStepInput = await step.invoke(
          nextStepInput,
          this._patchConfig(options, runManager?.getChild(`seq:step:${i + 1}`))
        );
      }
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    let concatSupported = true;
    let finalOutput;
    try {
      let finalGenerator = await steps[streamingStartStepIndex]._streamIterator(
        nextStepInput,
        this._patchConfig(
          options,
          runManager?.getChild(`seq:step:${streamingStartStepIndex + 1}`)
        )
      );
      const finalSteps = steps.slice(streamingStartStepIndex + 1);
      for (let i = 0; i < finalSteps.length; i += 1) {
        const step = finalSteps[i];
        finalGenerator = await step.transform(
          finalGenerator,
          this._patchConfig(
            options,
            runManager?.getChild(`seq:step:${streamingStartStepIndex + i + 2}`)
          )
        );
      }
      for await (const chunk of finalGenerator) {
        yield chunk;
        if (concatSupported) {
          if (finalOutput === undefined) {
            finalOutput = chunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              finalOutput = (finalOutput as any).concat(chunk);
            } catch (e) {
              finalOutput = undefined;
              concatSupported = false;
            }
          }
        }
      }
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(finalOutput, "output"));
  }

  pipe<NewRunOutput>(
    coerceable: RunnableLike<RunOutput, NewRunOutput>
  ): RunnableSequence<RunInput, Exclude<NewRunOutput, Error>> {
    if (RunnableSequence.isRunnableSequence(coerceable)) {
      return new RunnableSequence({
        first: this.first,
        middle: this.middle.concat([
          this.last,
          coerceable.first,
          ...coerceable.middle,
        ]),
        last: coerceable.last,
      });
    } else {
      return new RunnableSequence({
        first: this.first,
        middle: [...this.middle, this.last],
        last: _coerceToRunnable(coerceable),
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isRunnableSequence(thing: any): thing is RunnableSequence {
    return Array.isArray(thing.middle) && Runnable.isRunnable(thing);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static from<RunInput = any, RunOutput = any>([first, ...runnables]: [
    RunnableLike<RunInput>,
    ...RunnableLike[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunnableLike<any, RunOutput>
  ]) {
    return new RunnableSequence<RunInput, Exclude<RunOutput, Error>>({
      first: _coerceToRunnable(first),
      middle: runnables.slice(0, -1).map(_coerceToRunnable),
      last: _coerceToRunnable(runnables[runnables.length - 1]),
    });
  }
}

/**
 * A runnable that runs a mapping of runnables in parallel,
 * and returns a mapping of their outputs.
 */
export class RunnableMap<RunInput> extends Runnable<
  RunInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, any>
> {
  static lc_name() {
    return "RunnableMap";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  protected steps: Record<string, Runnable<RunInput>>;

  constructor(fields: { steps: Record<string, RunnableLike<RunInput>> }) {
    super(fields);
    this.steps = {};
    for (const [key, value] of Object.entries(fields.steps)) {
      this.steps[key] = _coerceToRunnable(value);
    }
  }

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any>> {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(this.toJSON(), {
      input,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: Record<string, any> = {};
    try {
      for (const [key, runnable] of Object.entries(this.steps)) {
        const result = await runnable.invoke(
          input,
          this._patchConfig(options, runManager?.getChild())
        );
        output[key] = result;
      }
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(output);
    return output;
  }
}

/**
 * A runnable that runs a callable.
 */
export class RunnableLambda<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  static lc_name() {
    return "RunnableLambda";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  protected func: RunnableFunc<RunInput, RunOutput>;

  constructor(fields: { func: RunnableFunc<RunInput, RunOutput> }) {
    super(fields);
    this.func = fields.func;
  }

  async _invoke(
    input: RunInput,
    config?: Partial<BaseCallbackConfig>,
    runManager?: CallbackManagerForChainRun
  ) {
    let output = await this.func(input);
    if (output && Runnable.isRunnable(output)) {
      output = await output.invoke(
        input,
        this._patchConfig(config, runManager?.getChild())
      );
    }
    return output;
  }

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<RunOutput> {
    return this._callWithConfig(this._invoke, input, options);
  }
}

/**
 * A Runnable that can fallback to other Runnables if it fails.
 */
export class RunnableWithFallbacks<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  static lc_name() {
    return "RunnableWithFallbacks";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  protected runnable: Runnable<RunInput, RunOutput>;

  protected fallbacks: Runnable<RunInput, RunOutput>[];

  constructor(fields: {
    runnable: Runnable<RunInput, RunOutput>;
    fallbacks: Runnable<RunInput, RunOutput>[];
  }) {
    super(fields);
    this.runnable = fields.runnable;
    this.fallbacks = fields.fallbacks;
  }

  *runnables() {
    yield this.runnable;
    for (const fallback of this.fallbacks) {
      yield fallback;
    }
  }

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<RunOutput> {
    const callbackManager_ = await CallbackManager.configure(
      options?.callbacks,
      undefined,
      options?.tags,
      undefined,
      options?.metadata
    );
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input")
    );
    let firstError;
    for (const runnable of this.runnables()) {
      try {
        const output = await runnable.invoke(
          input,
          this._patchConfig(options, runManager?.getChild())
        );
        await runManager?.handleChainEnd(_coerceToDict(output, "output"));
        return output;
      } catch (e) {
        if (firstError === undefined) {
          firstError = e;
        }
      }
    }
    if (firstError === undefined) {
      throw new Error("No error stored at end of fallback.");
    }
    await runManager?.handleChainError(firstError);
    throw firstError;
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("Not implemented.");
    }
    const configList = this._getOptionsList(options ?? {}, inputs.length);
    const callbackManagers = await Promise.all(
      configList.map((config) =>
        CallbackManager.configure(
          config?.callbacks,
          undefined,
          config?.tags,
          undefined,
          config?.metadata
        )
      )
    );
    const runManagers = await Promise.all(
      callbackManagers.map((callbackManager, i) =>
        callbackManager?.handleChainStart(
          this.toJSON(),
          _coerceToDict(inputs[i], "input")
        )
      )
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let firstError: any;
    for (const runnable of this.runnables()) {
      try {
        const outputs = await runnable.batch(
          inputs,
          runManagers.map((runManager, j) =>
            this._patchConfig(configList[j], runManager?.getChild())
          ),
          batchOptions
        );
        await Promise.all(
          runManagers.map((runManager, i) =>
            runManager?.handleChainEnd(_coerceToDict(outputs[i], "output"))
          )
        );
        return outputs;
      } catch (e) {
        if (firstError === undefined) {
          firstError = e;
        }
      }
    }
    if (!firstError) {
      throw new Error("No error stored at end of fallbacks.");
    }
    await Promise.all(
      runManagers.map((runManager) => runManager?.handleChainError(firstError))
    );
    throw firstError;
  }
}

// TODO: Figure out why the compiler needs help eliminating Error as a RunOutput type
export function _coerceToRunnable<RunInput, RunOutput>(
  coerceable: RunnableLike<RunInput, RunOutput>
): Runnable<RunInput, Exclude<RunOutput, Error>> {
  if (typeof coerceable === "function") {
    return new RunnableLambda({ func: coerceable }) as Runnable<
      RunInput,
      Exclude<RunOutput, Error>
    >;
  } else if (Runnable.isRunnable(coerceable)) {
    return coerceable as Runnable<RunInput, Exclude<RunOutput, Error>>;
  } else if (!Array.isArray(coerceable) && typeof coerceable === "object") {
    const runnables: Record<string, Runnable<RunInput>> = {};
    for (const [key, value] of Object.entries(coerceable)) {
      runnables[key] = _coerceToRunnable(value);
    }
    return new RunnableMap<RunInput>({
      steps: runnables,
    }) as unknown as Runnable<RunInput, Exclude<RunOutput, Error>>;
  } else {
    throw new Error(
      `Expected a Runnable, function or object.\nInstead got an unsupported type.`
    );
  }
}
