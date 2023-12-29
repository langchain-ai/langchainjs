import pRetry from "p-retry";

import {
  CallbackManager,
  CallbackManagerForChainRun,
} from "../callbacks/manager.js";
import {
  LogStreamCallbackHandler,
  LogStreamCallbackHandlerInput,
  RunLogPatch,
} from "../tracers/log_stream.js";
import { Serializable } from "../load/serializable.js";
import {
  IterableReadableStream,
  concat,
  type IterableReadableStreamInterface,
  atee,
} from "../utils/stream.js";
import {
  DEFAULT_RECURSION_LIMIT,
  RunnableConfig,
  getCallbackMangerForConfig,
  mergeConfigs,
} from "./config.js";
import { AsyncCaller } from "../utils/async_caller.js";
import { Run } from "../tracers/base.js";
import { RootListenersTracer } from "../tracers/root_listener.js";

/**
 * Base interface implemented by all runnables.
 * Used for cross-compatibility between different versions of LangChain core.
 *
 * Should not change on patch releases.
 */
export interface RunnableInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends RunnableConfig = RunnableConfig
> {
  lc_serializable: boolean;

  invoke(input: RunInput, options?: Partial<CallOptions>): Promise<RunOutput>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStreamInterface<RunOutput>>;

  transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput>;
}

export type RunnableFunc<RunInput, RunOutput> = (
  input: RunInput,
  options?:
    | { config?: RunnableConfig }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | (Record<string, any> & { config: RunnableConfig })
) => RunOutput | Promise<RunOutput>;

export type RunnableMapLike<RunInput, RunOutput> = {
  [K in keyof RunOutput]: RunnableLike<RunInput, RunOutput[K]>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableLike<RunInput = any, RunOutput = any> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | RunnableInterface<RunInput, RunOutput>
  | RunnableFunc<RunInput, RunOutput>
  | RunnableMapLike<RunInput, RunOutput>;

export type RunnableBatchOptions = {
  maxConcurrency?: number;
  returnExceptions?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableRetryFailedAttemptHandler = (error: any) => any;

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
  >
  extends Serializable
  implements RunnableInterface<RunInput, RunOutput, CallOptions>
{
  protected lc_runnable = true;

  name?: string;

  getName(suffix?: string): string {
    const name =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.name ?? (this.constructor as any).lc_name() ?? this.constructor.name;
    return suffix ? `${name}${suffix}` : name;
  }

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
  ): Partial<CallOptions & { runType?: string }>[] {
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
      runName: options.runName,
      configurable: options.configurable,
    };
    const callOptions = { ...options };
    delete callOptions.callbacks;
    delete callOptions.tags;
    delete callOptions.metadata;
    delete callOptions.runName;
    delete callOptions.configurable;
    return [runnableConfig, callOptions];
  }

  protected async _callWithConfig<T extends RunInput>(
    func:
      | ((input: T) => Promise<RunOutput>)
      | ((
          input: T,
          config?: Partial<CallOptions>,
          runManager?: CallbackManagerForChainRun
        ) => Promise<RunOutput>),
    input: T,
    options?: Partial<CallOptions> & { runType?: string }
  ) {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      undefined,
      options?.runType,
      undefined,
      undefined,
      options?.runName ?? this.getName()
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
      options?: Partial<CallOptions>[],
      runManagers?: (CallbackManagerForChainRun | undefined)[],
      batchOptions?: RunnableBatchOptions
    ) => Promise<(RunOutput | Error)[]>,
    inputs: T[],
    options?:
      | Partial<CallOptions & { runType?: string }>
      | Partial<CallOptions & { runType?: string }>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    const optionsList = this._getOptionsList(options ?? {}, inputs.length);
    const callbackManagers = await Promise.all(
      optionsList.map(getCallbackMangerForConfig)
    );
    const runManagers = await Promise.all(
      callbackManagers.map((callbackManager, i) =>
        callbackManager?.handleChainStart(
          this.toJSON(),
          _coerceToDict(inputs[i], "input"),
          undefined,
          optionsList[i].runType,
          undefined,
          undefined,
          optionsList[i].runName ?? this.getName()
        )
      )
    );
    let outputs: (RunOutput | Error)[];
    try {
      outputs = await func(inputs, optionsList, runManagers, batchOptions);
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
      options?: Partial<CallOptions>
    ) => AsyncGenerator<O>,
    options?: CallOptions & { runType?: string }
  ): AsyncGenerator<O> {
    let finalInput: I | undefined;
    let finalInputSupported = true;
    let finalOutput: O | undefined;
    let finalOutputSupported = true;

    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      { input: "" },
      undefined,
      options?.runType,
      undefined,
      undefined,
      options?.runName ?? this.getName()
    );
    async function* wrapInputForTracing() {
      for await (const chunk of inputGenerator) {
        if (finalInputSupported) {
          if (finalInput === undefined) {
            finalInput = chunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              finalInput = concat(finalInput, chunk as any);
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
              finalOutput = concat(finalOutput, chunk as any);
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
    callbackManager: CallbackManager | undefined = undefined,
    recursionLimit: number | undefined = undefined
  ): Partial<CallOptions> {
    const newConfig = { ...config };
    if (callbackManager !== undefined) {
      /**
       * If we're replacing callbacks we need to unset runName
       * since that should apply only to the same run as the original callbacks
       */
      delete newConfig.runName;
      return { ...newConfig, callbacks: callbackManager };
    }
    if (recursionLimit !== undefined) {
      newConfig.recursionLimit = recursionLimit;
    }
    return newConfig;
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
   * Pick keys from the dict output of this runnable. Returns a new runnable.
   */
  pick(keys: string | string[]): RunnableSequence {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return this.pipe(new RunnablePick(keys) as Runnable);
  }

  /**
   * Assigns new fields to the dict output of this runnable. Returns a new runnable.
   */
  assign(
    mapping: RunnableMapLike<Record<string, unknown>, Record<string, unknown>>
  ): RunnableSequence {
    return this.pipe(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      new RunnableAssign(
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        new RunnableMap<Record<string, unknown>>({ steps: mapping })
      ) as Runnable
    );
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
      if (finalChunk === undefined) {
        finalChunk = chunk;
      } else {
        // Make a best effort to gather, for any type that supports concat.
        // This method should throw an error if gathering fails.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalChunk = concat(finalChunk, chunk as any);
      }
    }
    yield* this._streamIterator(finalChunk, options);
  }

  /**
   * Stream all output from a runnable, as reported to the callback system.
   * This includes all inner runs of LLMs, Retrievers, Tools, etc.
   * Output is streamed as Log objects, which include a list of
   * jsonpatch ops that describe how the state of the run has changed in each
   * step, and the final state of the run.
   * The jsonpatch ops can be applied in order to construct state.
   * @param input
   * @param options
   * @param streamOptions
   */
  async *streamLog(
    input: RunInput,
    options?: Partial<CallOptions>,
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<RunLogPatch> {
    const stream = new LogStreamCallbackHandler({
      ...streamOptions,
      autoClose: false,
    });
    const config: Partial<CallOptions> = options ?? {};
    const { callbacks } = config;
    if (callbacks === undefined) {
      config.callbacks = [stream];
    } else if (Array.isArray(callbacks)) {
      config.callbacks = callbacks.concat([stream]);
    } else {
      const copiedCallbacks = callbacks.copy();
      copiedCallbacks.inheritableHandlers.push(stream);
      config.callbacks = copiedCallbacks;
    }
    const runnableStream = await this.stream(input, config);
    async function consumeRunnableStream() {
      try {
        for await (const chunk of runnableStream) {
          const patch = new RunLogPatch({
            ops: [
              {
                op: "add",
                path: "/streamed_output/-",
                value: chunk,
              },
            ],
          });
          await stream.writer.write(patch);
        }
      } finally {
        await stream.writer.close();
      }
    }
    const runnableStreamPromise = consumeRunnableStream();
    try {
      for await (const log of stream) {
        yield log;
      }
    } finally {
      await runnableStreamPromise;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isRunnable(thing: any): thing is Runnable {
    return thing ? thing.lc_runnable : false;
  }

  /**
   * Bind lifecycle listeners to a Runnable, returning a new Runnable.
   * The Run object contains information about the run, including its id,
   * type, input, output, error, startTime, endTime, and any tags or metadata
   * added to the run.
   *
   * @param {Object} params - The object containing the callback functions.
   * @param {(run: Run) => void} params.onStart - Called before the runnable starts running, with the Run object.
   * @param {(run: Run) => void} params.onEnd - Called after the runnable finishes running, with the Run object.
   * @param {(run: Run) => void} params.onError - Called if the runnable throws an error, with the Run object.
   */
  withListeners({
    onStart,
    onEnd,
    onError,
  }: {
    onStart?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onEnd?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onError?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
  }): Runnable<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBinding<RunInput, RunOutput, CallOptions>({
      bound: this,
      config: {},
      configFactories: [
        (config) => ({
          callbacks: [
            new RootListenersTracer({
              config,
              onStart,
              onEnd,
              onError,
            }),
          ],
        }),
      ],
    });
  }
}

export type RunnableBindingArgs<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig
> = {
  bound: Runnable<RunInput, RunOutput, CallOptions>;
  kwargs?: Partial<CallOptions>;
  config: RunnableConfig;
  configFactories?: Array<(config: RunnableConfig) => RunnableConfig>;
};

/**
 * A runnable that delegates calls to another runnable with a set of kwargs.
 */
export class RunnableBinding<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  static lc_name() {
    return "RunnableBinding";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  bound: Runnable<RunInput, RunOutput, CallOptions>;

  config: RunnableConfig;

  protected kwargs?: Partial<CallOptions>;

  configFactories?: Array<
    (config: RunnableConfig) => RunnableConfig | Promise<RunnableConfig>
  >;

  constructor(fields: RunnableBindingArgs<RunInput, RunOutput, CallOptions>) {
    super(fields);
    this.bound = fields.bound;
    this.kwargs = fields.kwargs;
    this.config = fields.config;
    this.configFactories = fields.configFactories;
  }

  getName(suffix?: string | undefined): string {
    return this.bound.getName(suffix);
  }

  async _mergeConfig(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: Record<string, any>
  ): Promise<Partial<CallOptions>> {
    const config = mergeConfigs<CallOptions>(this.config, options);
    return mergeConfigs<CallOptions>(
      config,
      ...(this.configFactories
        ? await Promise.all(
            this.configFactories.map(
              async (configFactory) => await configFactory(config)
            )
          )
        : [])
    );
  }

  bind(
    kwargs: Partial<CallOptions>
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (this.constructor as any)({
      bound: this.bound,
      kwargs: { ...this.kwargs, ...kwargs },
      config: this.config,
    });
  }

  withConfig(
    config: RunnableConfig
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (this.constructor as any)({
      bound: this.bound,
      kwargs: this.kwargs,
      config: { ...this.config, ...config },
    });
  }

  withRetry(fields?: {
    stopAfterAttempt?: number;
    onFailedAttempt?: RunnableRetryFailedAttemptHandler;
  }): RunnableRetry<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (this.constructor as any)({
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
      await this._mergeConfig({ ...options, ...this.kwargs })
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
      ? await Promise.all(
          options.map(async (individualOption) =>
            this._mergeConfig({
              ...individualOption,
              ...this.kwargs,
            })
          )
        )
      : await this._mergeConfig({ ...options, ...this.kwargs });
    return this.bound.batch(inputs, mergedOptions, batchOptions);
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ) {
    yield* this.bound._streamIterator(
      input,
      await this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ): Promise<IterableReadableStream<RunOutput>> {
    return this.bound.stream(
      input,
      await this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  async *transform(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    yield* this.bound.transform(
      generator,
      await this._mergeConfig({ ...options, ...this.kwargs })
    );
  }

  static isRunnableBinding(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thing: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): thing is RunnableBinding<any, any, any> {
    return thing.bound && Runnable.isRunnable(thing.bound);
  }

  /**
   * Bind lifecycle listeners to a Runnable, returning a new Runnable.
   * The Run object contains information about the run, including its id,
   * type, input, output, error, startTime, endTime, and any tags or metadata
   * added to the run.
   *
   * @param {Object} params - The object containing the callback functions.
   * @param {(run: Run) => void} params.onStart - Called before the runnable starts running, with the Run object.
   * @param {(run: Run) => void} params.onEnd - Called after the runnable finishes running, with the Run object.
   * @param {(run: Run) => void} params.onError - Called if the runnable throws an error, with the Run object.
   */
  withListeners({
    onStart,
    onEnd,
    onError,
  }: {
    onStart?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onEnd?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onError?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
  }): Runnable<RunInput, RunOutput, CallOptions> {
    return new RunnableBinding<RunInput, RunOutput, CallOptions>({
      bound: this.bound,
      kwargs: this.kwargs,
      config: this.config,
      configFactories: [
        (config) => ({
          callbacks: [
            new RootListenersTracer({
              config,
              onStart,
              onEnd,
              onError,
            }),
          ],
        }),
      ],
    });
  }
}

/**
 * A runnable that delegates calls to another runnable
 * with each element of the input sequence.
 */
export class RunnableEach<
  RunInputItem,
  RunOutputItem,
  CallOptions extends RunnableConfig
> extends Runnable<RunInputItem[], RunOutputItem[], CallOptions> {
  static lc_name() {
    return "RunnableEach";
  }

  lc_serializable = true;

  lc_namespace = ["langchain_core", "runnables"];

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

  /**
   * Bind lifecycle listeners to a Runnable, returning a new Runnable.
   * The Run object contains information about the run, including its id,
   * type, input, output, error, startTime, endTime, and any tags or metadata
   * added to the run.
   *
   * @param {Object} params - The object containing the callback functions.
   * @param {(run: Run) => void} params.onStart - Called before the runnable starts running, with the Run object.
   * @param {(run: Run) => void} params.onEnd - Called after the runnable finishes running, with the Run object.
   * @param {(run: Run) => void} params.onError - Called if the runnable throws an error, with the Run object.
   */
  withListeners({
    onStart,
    onEnd,
    onError,
  }: {
    onStart?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onEnd?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onError?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Runnable<any, any, CallOptions> {
    return new RunnableEach<RunInputItem, RunOutputItem, CallOptions>({
      bound: this.bound.withListeners({ onStart, onEnd, onError }),
    });
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

  lc_namespace = ["langchain_core", "runnables"];

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
 * @example
 * ```typescript
 * const promptTemplate = PromptTemplate.fromTemplate(
 *   "Tell me a joke about {topic}",
 * );
 * const chain = RunnableSequence.from([promptTemplate, new ChatOpenAI({})]);
 * const result = await chain.invoke({ topic: "bears" });
 * ```
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

  lc_namespace = ["langchain_core", "runnables"];

  constructor(fields: {
    first: Runnable<RunInput>;
    middle?: Runnable[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last: Runnable<any, RunOutput>;
    name?: string;
  }) {
    super(fields);
    this.first = fields.first;
    this.middle = fields.middle ?? this.middle;
    this.last = fields.last;
    this.name = fields.name;
  }

  get steps() {
    return [this.first, ...this.middle, this.last];
  }

  async invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput> {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      undefined,
      undefined,
      undefined,
      undefined,
      options?.runName
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
          _coerceToDict(inputs[i], "input"),
          undefined,
          undefined,
          undefined,
          undefined,
          configList[i].runName
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
      _coerceToDict(input, "input"),
      undefined,
      undefined,
      undefined,
      undefined,
      options?.runName
    );
    const steps = [this.first, ...this.middle, this.last];
    let concatSupported = true;
    let finalOutput;
    async function* inputGenerator() {
      yield input;
    }
    try {
      let finalGenerator = steps[0].transform(
        inputGenerator(),
        this._patchConfig(options, runManager?.getChild(`seq:step:1`))
      );
      for (let i = 1; i < steps.length; i += 1) {
        const step = steps[i];
        finalGenerator = await step.transform(
          finalGenerator,
          this._patchConfig(options, runManager?.getChild(`seq:step:${i + 1}`))
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
              finalOutput = concat(finalOutput, chunk as any);
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
        name: this.name ?? coerceable.name,
      });
    } else {
      return new RunnableSequence({
        first: this.first,
        middle: [...this.middle, this.last],
        last: _coerceToRunnable(coerceable),
        name: this.name,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isRunnableSequence(thing: any): thing is RunnableSequence {
    return Array.isArray(thing.middle) && Runnable.isRunnable(thing);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static from<RunInput = any, RunOutput = any>(
    [first, ...runnables]: [
      RunnableLike<RunInput>,
      ...RunnableLike[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      RunnableLike<any, RunOutput>
    ],
    name?: string
  ) {
    return new RunnableSequence<RunInput, Exclude<RunOutput, Error>>({
      first: _coerceToRunnable(first),
      middle: runnables.slice(0, -1).map(_coerceToRunnable),
      last: _coerceToRunnable(runnables[runnables.length - 1]),
      name,
    });
  }
}

/**
 * A runnable that runs a mapping of runnables in parallel,
 * and returns a mapping of their outputs.
 * @example
 * ```typescript
 * const mapChain = RunnableMap.from({
 *   joke: PromptTemplate.fromTemplate("Tell me a joke about {topic}").pipe(
 *     new ChatAnthropic({}),
 *   ),
 *   poem: PromptTemplate.fromTemplate("write a 2-line poem about {topic}").pipe(
 *     new ChatAnthropic({}),
 *   ),
 * });
 * const result = await mapChain.invoke({ topic: "bear" });
 * ```
 */
export class RunnableMap<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
> extends Runnable<RunInput, RunOutput> {
  static lc_name() {
    return "RunnableMap";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  protected steps: Record<string, Runnable<RunInput>>;

  public getStepsKeys(): string[] {
    return Object.keys(this.steps);
  }

  constructor(fields: { steps: RunnableMapLike<RunInput, RunOutput> }) {
    super(fields);
    this.steps = {};
    for (const [key, value] of Object.entries(fields.steps)) {
      this.steps[key] = _coerceToRunnable(value);
    }
  }

  static from<
    RunInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    steps: RunnableMapLike<RunInput, RunOutput>
  ): RunnableMap<RunInput, RunOutput> {
    return new RunnableMap<RunInput, RunOutput>({ steps });
  }

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<RunOutput> {
    const callbackManager_ = await getCallbackMangerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      {
        input,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      options?.runName
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: Record<string, any> = {};
    try {
      await Promise.all(
        Object.entries(this.steps).map(async ([key, runnable]) => {
          output[key] = await runnable.invoke(
            input,
            this._patchConfig(options, runManager?.getChild(`map:key:${key}`))
          );
        })
      );
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(output);
    return output as RunOutput;
  }

  async *_transform(
    generator: AsyncGenerator<RunInput>,
    runManager?: CallbackManagerForChainRun,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    // shallow copy steps to ignore changes while iterating
    const steps = { ...this.steps };
    // each step gets a copy of the input iterator
    const inputCopies = atee(generator, Object.keys(steps).length);
    // start the first iteration of each output iterator
    const tasks = new Map(
      Object.entries(steps).map(([key, runnable], i) => {
        const gen = runnable.transform(
          inputCopies[i],
          this._patchConfig(options, runManager?.getChild(`map:key:${key}`))
        );
        return [key, gen.next().then((result) => ({ key, gen, result }))];
      })
    );
    // yield chunks as they become available,
    // starting new iterations as needed,
    // until all iterators are done
    while (tasks.size) {
      const { key, result, gen } = await Promise.race(tasks.values());
      tasks.delete(key);
      if (!result.done) {
        yield { [key]: result.value } as unknown as RunOutput;
        tasks.set(
          key,
          gen.next().then((result) => ({ key, gen, result }))
        );
      }
    }
  }

  transform(
    generator: AsyncGenerator<RunInput>,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    return this._transformStreamWithConfig(
      generator,
      this._transform.bind(this),
      options
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    async function* generator() {
      yield input;
    }
    return IterableReadableStream.fromAsyncGenerator(
      this.transform(generator(), options)
    );
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

  lc_namespace = ["langchain_core", "runnables"];

  protected func: RunnableFunc<
    RunInput,
    RunOutput | Runnable<RunInput, RunOutput>
  >;

  constructor(fields: {
    func: RunnableFunc<RunInput, RunOutput | Runnable<RunInput, RunOutput>>;
  }) {
    super(fields);
    this.func = fields.func;
  }

  static from<RunInput, RunOutput>(
    func: RunnableFunc<RunInput, RunOutput | Runnable<RunInput, RunOutput>>
  ): RunnableLambda<RunInput, RunOutput> {
    return new RunnableLambda({
      func,
    });
  }

  async _invoke(
    input: RunInput,
    config?: Partial<RunnableConfig>,
    runManager?: CallbackManagerForChainRun
  ) {
    let output = await this.func(input, { config });
    if (output && Runnable.isRunnable(output)) {
      if (config?.recursionLimit === 0) {
        throw new Error("Recursion limit reached.");
      }
      output = await output.invoke(
        input,
        this._patchConfig(
          config,
          runManager?.getChild(),
          (config?.recursionLimit ?? DEFAULT_RECURSION_LIMIT) - 1
        )
      );
    }
    return output;
  }

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<RunOutput> {
    return this._callWithConfig(this._invoke, input, options);
  }

  async *_transform(
    generator: AsyncGenerator<RunInput>,
    runManager?: CallbackManagerForChainRun,
    config?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    let finalChunk;
    for await (const chunk of generator) {
      if (finalChunk === undefined) {
        finalChunk = chunk;
      } else {
        // Make a best effort to gather, for any type that supports concat.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalChunk = concat(finalChunk, chunk as any);
        } catch (e) {
          finalChunk = chunk;
        }
      }
    }

    const output = await this.func(finalChunk, { config });
    if (output && Runnable.isRunnable(output)) {
      if (config?.recursionLimit === 0) {
        throw new Error("Recursion limit reached.");
      }
      const stream = await output.stream(
        finalChunk,
        this._patchConfig(
          config,
          runManager?.getChild(),
          (config?.recursionLimit ?? DEFAULT_RECURSION_LIMIT) - 1
        )
      );
      for await (const chunk of stream) {
        yield chunk;
      }
    } else {
      yield output;
    }
  }

  transform(
    generator: AsyncGenerator<RunInput>,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    return this._transformStreamWithConfig(
      generator,
      this._transform.bind(this),
      options
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    async function* generator() {
      yield input;
    }
    return IterableReadableStream.fromAsyncGenerator(
      this.transform(generator(), options)
    );
  }
}

export class RunnableParallel<RunInput> extends RunnableMap<RunInput> {}

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

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  runnable: Runnable<RunInput, RunOutput>;

  fallbacks: Runnable<RunInput, RunOutput>[];

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
    options?: Partial<RunnableConfig>
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
      _coerceToDict(input, "input"),
      undefined,
      undefined,
      undefined,
      undefined,
      options?.runName
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
          _coerceToDict(inputs[i], "input"),
          undefined,
          undefined,
          undefined,
          undefined,
          configList[i].runName
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
      runnables[key] = _coerceToRunnable(value as RunnableLike);
    }
    return new RunnableMap({
      steps: runnables,
    }) as unknown as Runnable<RunInput, Exclude<RunOutput, Error>>;
  } else {
    throw new Error(
      `Expected a Runnable, function or object.\nInstead got an unsupported type.`
    );
  }
}

export interface RunnableAssignFields<RunInput> {
  mapper: RunnableMap<RunInput>;
}

/**
 * A runnable that assigns key-value pairs to inputs of type `Record<string, unknown>`.
 */
export class RunnableAssign<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends Record<string, any> = Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
    CallOptions extends RunnableConfig = RunnableConfig
  >
  extends Runnable<RunInput, RunOutput>
  implements RunnableAssignFields<RunInput>
{
  static lc_name() {
    return "RunnableAssign";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  mapper: RunnableMap<RunInput>;

  constructor(fields: RunnableMap<RunInput> | RunnableAssignFields<RunInput>) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (fields instanceof RunnableMap) {
      // eslint-disable-next-line no-param-reassign
      fields = { mapper: fields };
    }
    super(fields);
    this.mapper = fields.mapper;
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    const mapperResult = await this.mapper.invoke(input, options);

    return {
      ...input,
      ...mapperResult,
    } as RunOutput;
  }

  async *_transform(
    generator: AsyncGenerator<RunInput>,
    runManager?: CallbackManagerForChainRun,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    // collect mapper keys
    const mapperKeys = this.mapper.getStepsKeys();
    // create two input gens, one for the mapper, one for the input
    const [forPassthrough, forMapper] = atee(generator, 2);
    // create mapper output gen
    const mapperOutput = this.mapper.transform(
      forMapper,
      this._patchConfig(options, runManager?.getChild())
    );
    // start the mapper
    const firstMapperChunkPromise = mapperOutput.next();
    // yield the passthrough
    for await (const chunk of forPassthrough) {
      if (typeof chunk !== "object" || Array.isArray(chunk)) {
        throw new Error(
          `RunnableAssign can only be used with objects as input, got ${typeof chunk}`
        );
      }
      const filtered = Object.fromEntries(
        Object.entries(chunk).filter(([key]) => !mapperKeys.includes(key))
      );
      if (Object.keys(filtered).length > 0) {
        yield filtered as unknown as RunOutput;
      }
    }
    // yield the mapper output
    yield (await firstMapperChunkPromise).value;
    for await (const chunk of mapperOutput) {
      yield chunk as unknown as RunOutput;
    }
  }

  transform(
    generator: AsyncGenerator<RunInput>,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    return this._transformStreamWithConfig(
      generator,
      this._transform.bind(this),
      options
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    async function* generator() {
      yield input;
    }
    return IterableReadableStream.fromAsyncGenerator(
      this.transform(generator(), options)
    );
  }
}

export interface RunnablePickFields {
  keys: string | string[];
}

/**
 * A runnable that assigns key-value pairs to inputs of type `Record<string, unknown>`.
 */
export class RunnablePick<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends Record<string, any> = Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> | any = Record<string, any> | any,
    CallOptions extends RunnableConfig = RunnableConfig
  >
  extends Runnable<RunInput, RunOutput>
  implements RunnablePickFields
{
  static lc_name() {
    return "RunnablePick";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  keys: string | string[];

  constructor(fields: string | string[] | RunnablePickFields) {
    if (typeof fields === "string" || Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { keys: fields };
    }
    super(fields);
    this.keys = fields.keys;
  }

  async _pick(input: RunInput): Promise<RunOutput> {
    if (typeof this.keys === "string") {
      return input[this.keys];
    } else {
      const picked = this.keys
        .map((key) => [key, input[key]])
        .filter((v) => v[1] !== undefined);
      return picked.length === 0 ? undefined : Object.fromEntries(picked);
    }
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    return this._callWithConfig(this._pick.bind(this), input, options);
  }

  async *_transform(
    generator: AsyncGenerator<RunInput>
  ): AsyncGenerator<RunOutput> {
    for await (const chunk of generator) {
      const picked = await this._pick(chunk);
      if (picked !== undefined) {
        yield picked;
      }
    }
  }

  transform(
    generator: AsyncGenerator<RunInput>,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    return this._transformStreamWithConfig(
      generator,
      this._transform.bind(this),
      options
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    async function* generator() {
      yield input;
    }
    return IterableReadableStream.fromAsyncGenerator(
      this.transform(generator(), options)
    );
  }
}
