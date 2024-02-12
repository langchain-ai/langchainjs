import pRetry from "p-retry";

import {
  CallbackManager,
  CallbackManagerForChainRun,
} from "../callbacks/manager.js";
import {
  LogStreamCallbackHandler,
  LogStreamCallbackHandlerInput,
  RunLog,
  RunLogPatch,
  StreamEvent,
  StreamEventData,
} from "../tracers/log_stream.js";
import { Serializable } from "../load/serializable.js";
import {
  IterableReadableStream,
  concat,
  type IterableReadableStreamInterface,
  atee,
  pipeGeneratorWithSetup,
  AsyncGeneratorWithSetup,
} from "../utils/stream.js";
import {
  DEFAULT_RECURSION_LIMIT,
  RunnableConfig,
  ensureConfig,
  getCallbackManagerForConfig,
  mergeConfigs,
  patchConfig,
} from "./config.js";
import { AsyncCaller } from "../utils/async_caller.js";
import { Run } from "../tracers/base.js";
import { RootListenersTracer } from "../tracers/root_listener.js";
import { BaseCallbackHandler } from "../callbacks/base.js";
import { _RootEventFilter } from "./utils.js";
import { RunTree } from "langsmith/run_trees";

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

// TODO: Make `options` just take `RunnableConfig`
export type RunnableFunc<RunInput, RunOutput> = (
  input: RunInput,
  options?:
    | ({ config?: RunnableConfig } & RunnableConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | (Record<string, any> & { config: RunnableConfig } & RunnableConfig)
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
  /** @deprecated Pass in via the standard runnable config object instead */
  maxConcurrency?: number;
  returnExceptions?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableRetryFailedAttemptHandler = (error: any) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _coerceToDict(value: any, defaultKey: string) {
  return value &&
    !Array.isArray(value) &&
    // eslint-disable-next-line no-instanceof/no-instanceof
    !(value instanceof Date) &&
    typeof value === "object"
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

  protected _getOptionsList<O extends CallOptions & { runType?: string }>(
    options: Partial<O> | Partial<O>[],
    length = 0
  ): Partial<O>[] {
    if (Array.isArray(options)) {
      if (options.length !== length) {
        throw new Error(
          `Passed "options" must be an array with the same length as the inputs, but got ${options.length} options for ${length} inputs`
        );
      }
      return options.map(ensureConfig);
    }
    return Array.from({ length }, () => ensureConfig(options));
  }

  /**
   * Default implementation of batch, which calls invoke N times.
   * Subclasses should override this method if they can batch more efficiently.
   * @param inputs Array of inputs to each batch call.
   * @param options Either a single call options object to apply to each batch call or an array for each call.
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
    const maxConcurrency =
      configList[0]?.maxConcurrency ?? batchOptions?.maxConcurrency;
    const caller = new AsyncCaller({
      maxConcurrency,
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
    // Buffer the first streamed chunk to allow for initial errors
    // to surface immediately.
    const wrappedGenerator = new AsyncGeneratorWithSetup(
      this._streamIterator(input, options)
    );
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
  }

  protected _separateRunnableConfigFromCallOptions(
    options: Partial<CallOptions> = {}
  ): [RunnableConfig, Omit<Partial<CallOptions>, keyof RunnableConfig>] {
    const runnableConfig: RunnableConfig = ensureConfig({
      callbacks: options.callbacks,
      tags: options.tags,
      metadata: options.metadata,
      runName: options.runName,
      configurable: options.configurable,
      recursionLimit: options.recursionLimit,
      maxConcurrency: options.maxConcurrency,
    });
    const callOptions = { ...options };
    delete callOptions.callbacks;
    delete callOptions.tags;
    delete callOptions.metadata;
    delete callOptions.runName;
    delete callOptions.configurable;
    delete callOptions.recursionLimit;
    delete callOptions.maxConcurrency;
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
    const config = ensureConfig(options);
    const callbackManager_ = await getCallbackManagerForConfig(config);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      undefined,
      config?.runType,
      undefined,
      undefined,
      config?.runName ?? this.getName()
    );
    let output;
    try {
      output = await func.call(this, input, config, runManager);
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
      optionsList.map(getCallbackManagerForConfig)
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
      outputs = await func.call(
        this,
        inputs,
        optionsList,
        runManagers,
        batchOptions
      );
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

    const config = ensureConfig(options);
    const callbackManager_ = await getCallbackManagerForConfig(config);
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

    let runManager: CallbackManagerForChainRun | undefined;
    try {
      const pipe = await pipeGeneratorWithSetup(
        transformer.bind(this),
        wrapInputForTracing(),
        async () =>
          callbackManager_?.handleChainStart(
            this.toJSON(),
            { input: "" },
            undefined,
            config?.runType,
            undefined,
            undefined,
            config?.runName ?? this.getName()
          ),
        config
      );
      runManager = pipe.setup;
      const isLogStreamHandler = (
        handler: BaseCallbackHandler
      ): handler is LogStreamCallbackHandler =>
        handler.name === "log_stream_tracer";
      const streamLogHandler = runManager?.handlers.find(isLogStreamHandler);
      let iterator = pipe.output;
      if (streamLogHandler !== undefined && runManager !== undefined) {
        iterator = await streamLogHandler.tapOutputIterable(
          runManager.runId,
          pipe.output
        );
      }
      for await (const chunk of iterator) {
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

  /**
   * Create a new runnable sequence that runs each individual runnable in series,
   * piping the output of one runnable into another runnable or runnable-like.
   * @param coerceable A runnable, function, or object whose values are functions or runnables.
   * @returns A new runnable sequence.
   */
  pipe<NewRunOutput>(
    coerceable: RunnableLike<RunOutput, NewRunOutput>
  ): Runnable<RunInput, Exclude<NewRunOutput, Error>> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableSequence({
      first: this,
      last: _coerceToRunnable(coerceable),
    });
  }

  /**
   * Pick keys from the dict output of this runnable. Returns a new runnable.
   */
  pick(keys: string | string[]): Runnable {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return this.pipe(new RunnablePick(keys) as Runnable);
  }

  /**
   * Assigns new fields to the dict output of this runnable. Returns a new runnable.
   */
  assign(
    mapping: RunnableMapLike<Record<string, unknown>, Record<string, unknown>>
  ): Runnable {
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
    const logStreamCallbackHandler = new LogStreamCallbackHandler({
      ...streamOptions,
      autoClose: false,
      _schemaFormat: "original",
    });
    const config = ensureConfig(options);
    yield* this._streamLog(input, logStreamCallbackHandler, config);
  }

  protected async *_streamLog(
    input: RunInput,
    logStreamCallbackHandler: LogStreamCallbackHandler,
    config: Partial<CallOptions>
  ): AsyncGenerator<RunLogPatch> {
    const { callbacks } = config;
    if (callbacks === undefined) {
      // eslint-disable-next-line no-param-reassign
      config.callbacks = [logStreamCallbackHandler];
    } else if (Array.isArray(callbacks)) {
      // eslint-disable-next-line no-param-reassign
      config.callbacks = callbacks.concat([logStreamCallbackHandler]);
    } else {
      const copiedCallbacks = callbacks.copy();
      copiedCallbacks.inheritableHandlers.push(logStreamCallbackHandler);
      // eslint-disable-next-line no-param-reassign
      config.callbacks = copiedCallbacks;
    }
    const runnableStreamPromise = this.stream(input, config);
    async function consumeRunnableStream() {
      try {
        const runnableStream = await runnableStreamPromise;
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
          await logStreamCallbackHandler.writer.write(patch);
        }
      } finally {
        await logStreamCallbackHandler.writer.close();
      }
    }
    const runnableStreamConsumePromise = consumeRunnableStream();
    try {
      for await (const log of logStreamCallbackHandler) {
        yield log;
      }
    } finally {
      await runnableStreamConsumePromise;
    }
  }

  /**
   * Generate a stream of events emitted by the internal steps of the runnable.
   *
   * Use to create an iterator over StreamEvents that provide real-time information
   * about the progress of the runnable, including StreamEvents from intermediate
   * results.
   *
   * A StreamEvent is a dictionary with the following schema:
   *
   * - `event`: string - Event names are of the format: on_[runnable_type]_(start|stream|end).
   * - `name`: string - The name of the runnable that generated the event.
   * - `run_id`: string - Randomly generated ID associated with the given execution of
   *   the runnable that emitted the event. A child runnable that gets invoked as part of the execution of a
   *   parent runnable is assigned its own unique ID.
   * - `tags`: string[] - The tags of the runnable that generated the event.
   * - `metadata`: Record<string, any> - The metadata of the runnable that generated the event.
   * - `data`: Record<string, any>
   *
   * Below is a table that illustrates some events that might be emitted by various
   * chains. Metadata fields have been omitted from the table for brevity.
   * Chain definitions have been included after the table.
   *
   * | event                | name             | chunk                              | input                                         | output                                          |
   * |----------------------|------------------|------------------------------------|-----------------------------------------------|-------------------------------------------------|
   * | on_llm_start         | [model name]     |                                    | {'input': 'hello'}                            |                                                 |
   * | on_llm_stream        | [model name]     | 'Hello' OR AIMessageChunk("hello") |                                               |                                                 |
   * | on_llm_end           | [model name]     |                                    | 'Hello human!'                                |
   * | on_chain_start       | format_docs      |                                    |                                               |                                                 |
   * | on_chain_stream      | format_docs      | "hello world!, goodbye world!"     |                                               |                                                 |
   * | on_chain_end         | format_docs      |                                    | [Document(...)]                               | "hello world!, goodbye world!"                  |
   * | on_tool_start        | some_tool        |                                    | {"x": 1, "y": "2"}                            |                                                 |
   * | on_tool_stream       | some_tool        |   {"x": 1, "y": "2"}               |                                               |                                                 |
   * | on_tool_end          | some_tool        |                                    |                                               | {"x": 1, "y": "2"}                              |
   * | on_retriever_start   | [retriever name] |                                    | {"query": "hello"}                            |                                                 |
   * | on_retriever_chunk   | [retriever name] |  {documents: [...]}                |                                               |                                                 |
   * | on_retriever_end     | [retriever name] |                                    | {"query": "hello"}                            | {documents: [...]}                              |
   * | on_prompt_start      | [template_name]  |                                    | {"question": "hello"}                         |                                                 |
   * | on_prompt_end        | [template_name]  |                                    | {"question": "hello"}                         | ChatPromptValue(messages: [SystemMessage, ...]) |
   */
  async *streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & { version: "v1" },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<StreamEvent> {
    if (options.version !== "v1") {
      throw new Error(
        `Only version "v1" of the events schema is currently supported.`
      );
    }
    let runLog;
    let hasEncounteredStartEvent = false;
    const config = ensureConfig(options);
    const rootTags = config.tags ?? [];
    const rootMetadata = config.metadata ?? {};
    const rootName = config.runName ?? this.getName();
    const logStreamCallbackHandler = new LogStreamCallbackHandler({
      ...streamOptions,
      autoClose: false,
      _schemaFormat: "streaming_events",
    });
    const rootEventFilter = new _RootEventFilter({
      ...streamOptions,
    });
    const logStream = this._streamLog(input, logStreamCallbackHandler, config);
    for await (const log of logStream) {
      if (!runLog) {
        runLog = RunLog.fromRunLogPatch(log);
      } else {
        runLog = runLog.concat(log);
      }
      if (runLog.state === undefined) {
        throw new Error(
          `Internal error: "streamEvents" state is missing. Please open a bug report.`
        );
      }
      // Yield the start event for the root runnable if it hasn't been seen.
      // The root run is never filtered out
      if (!hasEncounteredStartEvent) {
        hasEncounteredStartEvent = true;
        const state = { ...runLog.state };
        const event: StreamEvent = {
          run_id: state.id,
          event: `on_${state.type}_start`,
          name: rootName,
          tags: rootTags,
          metadata: rootMetadata,
          data: {
            input,
          },
        };
        if (rootEventFilter.includeEvent(event, state.type)) {
          yield event;
        }
      }
      const paths = log.ops
        .filter((op) => op.path.startsWith("/logs/"))
        .map((op) => op.path.split("/")[2]);
      const dedupedPaths = [...new Set(paths)];
      for (const path of dedupedPaths) {
        let eventType;
        let data: StreamEventData = {};
        const logEntry = runLog.state.logs[path];
        if (logEntry.end_time === undefined) {
          if (logEntry.streamed_output.length > 0) {
            eventType = "stream";
          } else {
            eventType = "start";
          }
        } else {
          eventType = "end";
        }
        if (eventType === "start") {
          // Include the inputs with the start event if they are available.
          // Usually they will NOT be available for components that operate
          // on streams, since those components stream the input and
          // don't know its final value until the end of the stream.
          if (logEntry.inputs !== undefined) {
            data.input = logEntry.inputs;
          }
        } else if (eventType === "end") {
          if (logEntry.inputs !== undefined) {
            data.input = logEntry.inputs;
          }
          data.output = logEntry.final_output;
        } else if (eventType === "stream") {
          const chunkCount = logEntry.streamed_output.length;
          if (chunkCount !== 1) {
            throw new Error(
              `Expected exactly one chunk of streamed output, got ${chunkCount} instead. Encountered in: "${logEntry.name}"`
            );
          }
          data = { chunk: logEntry.streamed_output[0] };
          // Clean up the stream, we don't need it anymore.
          // And this avoids duplicates as well!
          logEntry.streamed_output = [];
        }
        yield {
          event: `on_${logEntry.type}_${eventType}`,
          name: logEntry.name,
          run_id: logEntry.id,
          tags: logEntry.tags,
          metadata: logEntry.metadata,
          data,
        };
      }
      // Finally, we take care of the streaming output from the root chain
      // if there is any.
      const { state } = runLog;
      if (state.streamed_output.length > 0) {
        const chunkCount = state.streamed_output.length;
        if (chunkCount !== 1) {
          throw new Error(
            `Expected exactly one chunk of streamed output, got ${chunkCount} instead. Encountered in: "${state.name}"`
          );
        }
        const data = { chunk: state.streamed_output[0] };
        // Clean up the stream, we don't need it anymore.
        state.streamed_output = [];
        const event = {
          event: `on_${state.type}_stream`,
          run_id: state.id,
          tags: rootTags,
          metadata: rootMetadata,
          name: rootName,
          data,
        };
        if (rootEventFilter.includeEvent(event, state.type)) {
          yield event;
        }
      }
    }
    const state = runLog?.state;
    if (state !== undefined) {
      // Finally, yield the end event for the root runnable.
      const event = {
        event: `on_${state.type}_end`,
        name: rootName,
        run_id: state.id,
        tags: rootTags,
        metadata: rootMetadata,
        data: {
          output: state.final_output,
        },
      };
      if (rootEventFilter.includeEvent(event, state.type)) yield event;
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
    ...options: (Partial<CallOptions> | RunnableConfig | undefined)[]
  ): Promise<Partial<CallOptions>> {
    const config = mergeConfigs(this.config, ...options);
    return mergeConfigs(
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
      await this._mergeConfig(options, this.kwargs)
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
            this._mergeConfig(individualOption, this.kwargs)
          )
        )
      : await this._mergeConfig(options, this.kwargs);
    return this.bound.batch(inputs, mergedOptions, batchOptions);
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ) {
    yield* this.bound._streamIterator(
      input,
      await this._mergeConfig(options, this.kwargs)
    );
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ): Promise<IterableReadableStream<RunOutput>> {
    return this.bound.stream(
      input,
      await this._mergeConfig(options, this.kwargs)
    );
  }

  async *transform(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    yield* this.bound.transform(
      generator,
      await this._mergeConfig(options, this.kwargs)
    );
  }

  async *streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & { version: "v1" },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<StreamEvent> {
    yield* this.bound.streamEvents(
      input,
      {
        ...(await this._mergeConfig(options, this.kwargs)),
        version: options.version,
      },
      streamOptions
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
   * @param kwargs The arguments to bind the runnable with.
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
      patchConfig(config, { callbacks: runManager?.getChild() })
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
    return patchConfig(config, { callbacks: runManager?.getChild(tag) });
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
    const callbackManager_ = await getCallbackManagerForConfig(options);
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
          patchConfig(options, {
            callbacks: runManager?.getChild(`seq:step:${i + 1}`),
          })
        );
      }
      // TypeScript can't detect that the last output of the sequence returns RunOutput, so call it out of the loop here
      finalOutput = await this.last.invoke(
        nextStepInput,
        patchConfig(options, {
          callbacks: runManager?.getChild(`seq:step:${this.steps.length}`),
        })
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
      configList.map(getCallbackManagerForConfig)
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
    try {
      for (let i = 0; i < this.steps.length; i += 1) {
        const step = this.steps[i];
        nextStepInputs = await step.batch(
          nextStepInputs,
          runManagers.map((runManager, j) => {
            const childRunManager = runManager?.getChild(`seq:step:${i + 1}`);
            return patchConfig(configList[j], { callbacks: childRunManager });
          }),
          batchOptions
        );
      }
    } catch (e) {
      await Promise.all(
        runManagers.map((runManager) => runManager?.handleChainError(e))
      );
      throw e;
    }
    await Promise.all(
      runManagers.map((runManager) =>
        runManager?.handleChainEnd(_coerceToDict(nextStepInputs, "output"))
      )
    );
    return nextStepInputs;
  }

  async *_streamIterator(
    input: RunInput,
    options?: RunnableConfig
  ): AsyncGenerator<RunOutput> {
    const callbackManager_ = await getCallbackManagerForConfig(options);
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
        patchConfig(options, {
          callbacks: runManager?.getChild(`seq:step:1`),
        })
      );
      for (let i = 1; i < steps.length; i += 1) {
        const step = steps[i];
        finalGenerator = await step.transform(
          finalGenerator,
          patchConfig(options, {
            callbacks: runManager?.getChild(`seq:step:${i + 1}`),
          })
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
    const callbackManager_ = await getCallbackManagerForConfig(options);
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
            patchConfig(options, {
              callbacks: runManager?.getChild(`map:key:${key}`),
            })
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
          patchConfig(options, {
            callbacks: runManager?.getChild(`map:key:${key}`),
          })
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
    const wrappedGenerator = new AsyncGeneratorWithSetup(
      this.transform(generator(), options)
    );
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
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
    let output = await this.func(input, { ...config, config });
    if (output && Runnable.isRunnable(output)) {
      if (config?.recursionLimit === 0) {
        throw new Error("Recursion limit reached.");
      }
      output = await output.invoke(
        input,
        patchConfig(config, {
          callbacks: runManager?.getChild(),
          recursionLimit:
            (config?.recursionLimit ?? DEFAULT_RECURSION_LIMIT) - 1,
        })
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

    const output = await this.func(finalChunk, { ...config, config });
    if (output && Runnable.isRunnable(output)) {
      if (config?.recursionLimit === 0) {
        throw new Error("Recursion limit reached.");
      }
      const stream = await output.stream(
        finalChunk,
        patchConfig(config, {
          callbacks: runManager?.getChild(),
          recursionLimit:
            (config?.recursionLimit ?? DEFAULT_RECURSION_LIMIT) - 1,
        })
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
    const wrappedGenerator = new AsyncGeneratorWithSetup(
      this.transform(generator(), options)
    );
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
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
          patchConfig(options, { callbacks: runManager?.getChild() })
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
            patchConfig(configList[j], {
              callbacks: runManager?.getChild(),
            })
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
    const [forPassthrough, forMapper] = atee(generator);
    // create mapper output gen
    const mapperOutput = this.mapper.transform(
      forMapper,
      patchConfig(options, { callbacks: runManager?.getChild() })
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
    const wrappedGenerator = new AsyncGeneratorWithSetup(
      this.transform(generator(), options)
    );
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
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
    const wrappedGenerator = new AsyncGeneratorWithSetup(
      this.transform(generator(), options)
    );
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
  }
}

type RunnableTraceeableFunc<RunInput, RunOutput> = (
  input: RunInput,
  options?: { config?: RunnableConfig; runTree: RunTree } & RunnableConfig
) => RunOutput | Promise<RunOutput>;

export class RunnableTraceable<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  lc_serializable = false;

  lc_namespace = ["langchain_core", "runnables"];

  protected func: RunnableTraceeableFunc<RunInput, RunOutput>;

  constructor(fields: { func: RunnableTraceeableFunc<RunInput, RunOutput> }) {
    super(fields);
    this.func = fields.func;
  }

  static from<RunInput, RunOutput>(
    func: RunnableTraceeableFunc<RunInput, RunOutput>
  ) {
    return new RunnableTraceable({ func });
  }

  async invoke(input: RunInput, options?: Partial<RunnableConfig>) {
    const config = ensureConfig(options);
    const callbackManager = await getCallbackManagerForConfig(config);

    const parentRunId = callbackManager?._parentRunId;

    const runTree = new RunTree({
      parent_run: parentRunId
        ? new RunTree({ name: "Parent", run_type: "chain", id: parentRunId })
        : undefined,
      name: "Wrapper",
      run_type: "chain",
    });

    return await this.func(input, { config, runTree });
  }
}
