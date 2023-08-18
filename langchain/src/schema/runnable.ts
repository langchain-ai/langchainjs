import { BaseCallbackConfig, CallbackManager } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";

export type RunnableConfig = BaseCallbackConfig;

export type RunnableFunc<RunInput, RunOutput> = (
  input: RunInput
) => RunOutput | Promise<RunOutput>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunnableLike<RunInput = any, RunOutput = any> =
  | Runnable<RunInput, RunOutput>
  | RunnableFunc<RunInput, RunOutput>
  | { [key: string]: RunnableLike<RunInput, RunOutput> };

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
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBinding({ bound: this, kwargs });
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
   * @returns An array of RunOutputs
   */
  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: {
      maxConcurrency?: number;
    }
  ): Promise<RunOutput[]> {
    const configList = this._getOptionsList(options ?? {}, inputs.length);
    const batchSize =
      batchOptions?.maxConcurrency && batchOptions.maxConcurrency > 0
        ? batchOptions?.maxConcurrency
        : inputs.length;
    const batchResults = [];
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batchPromises = inputs
        .slice(i, i + batchSize)
        .map((input, j) => this.invoke(input, configList[j]));
      const batchResult = await Promise.all(batchPromises);
      batchResults.push(batchResult);
    }
    return batchResults.flat();
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
    func: (input: T) => Promise<RunOutput>,
    input: T,
    options?: RunnableConfig & { runType?: string }
  ) {
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
      options?.runType
    );
    let output;
    try {
      output = await func.bind(this)(input);
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(output, "output"));
    return output;
  }

  protected async *_streamWithConfig<T extends RunOutput>(
    generator: AsyncGenerator<T>,
    options?: RunnableConfig & { runType?: string }
  ) {
    const callbackManager_ = await CallbackManager.configure(
      options?.callbacks,
      undefined,
      options?.tags,
      undefined,
      options?.metadata
    );
    // TODO: Find a way to pass the entire streamed value into the callback.
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict("<streamed value>", "input"),
      undefined,
      options?.runType
    );
    let output;
    let concatSupported = true;
    try {
      for await (const chunk of generator) {
        yield chunk;
        if (concatSupported) {
          if (output === undefined) {
            output = chunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              output = (output as any).concat(chunk);
            } catch (e) {
              output = undefined;
              concatSupported = false;
            }
          }
        }
      }
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(output, "output"));
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
  ): RunnableSequence<RunInput, NewRunOutput> {
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
  transform?(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isRunnable(thing: any): thing is Runnable {
    return thing.lc_runnable;
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
    let nextStepInput = input;
    let finalOutput: RunOutput;
    try {
      for (const step of [this.first, ...this.middle]) {
        nextStepInput = await step.invoke(
          nextStepInput,
          this._patchConfig(options, runManager?.getChild())
        );
      }
      // TypeScript can't detect that the last output of the sequence returns RunOutput, so call it out of the loop here
      finalOutput = await this.last.invoke(
        nextStepInput,
        this._patchConfig(options, runManager?.getChild())
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
    options?: RunnableConfig | RunnableConfig[],
    batchOptions?: { maxConcurrency?: number }
  ): Promise<RunOutput[]> {
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
    let nextStepInputs: any = inputs;
    let finalOutputs: RunOutput[];
    try {
      for (let i = 0; i < [this.first, ...this.middle].length; i += 1) {
        const step = this.steps[i];
        nextStepInputs = await step.batch(
          nextStepInputs,
          runManagers.map((runManager, j) =>
            this._patchConfig(configList[j], runManager?.getChild())
          ),
          batchOptions
        );
      }
      finalOutputs = await this.last.batch(
        nextStepInputs,
        runManagers.map((runManager) =>
          this._patchConfig(
            configList[this.steps.length - 1],
            runManager?.getChild()
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
    let nextStepInput = input;
    const steps = [this.first, ...this.middle, this.last];
    // Find the index of the last runnable in the sequence that doesn't have a .transform() method
    // and start streaming from there
    const streamingStartStepIndex =
      steps.length -
      [...steps]
        .reverse()
        .findIndex((step) => typeof step.transform !== "function") -
      1;
    try {
      for (const step of steps.slice(0, streamingStartStepIndex)) {
        nextStepInput = await step.invoke(
          nextStepInput,
          this._patchConfig(options, runManager?.getChild())
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
        this._patchConfig(options, runManager?.getChild())
      );
      for (const step of steps.slice(streamingStartStepIndex + 1)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        finalGenerator = await step.transform!(
          finalGenerator,
          this._patchConfig(options, runManager?.getChild())
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
  ): RunnableSequence<RunInput, NewRunOutput> {
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

  static from<RunInput, RunOutput>([first, ...runnables]: [
    RunnableLike<RunInput>,
    ...RunnableLike[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunnableLike<any, RunOutput>
  ]) {
    return new RunnableSequence<RunInput, RunOutput>({
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
    const callbackManager_ = await CallbackManager.configure(
      options?.callbacks,
      undefined,
      options?.tags,
      undefined,
      options?.metadata
    );
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
  lc_namespace = ["langchain", "schema", "runnable"];

  protected func: RunnableFunc<RunInput, RunOutput>;

  constructor(fields: { func: RunnableFunc<RunInput, RunOutput> }) {
    super(fields);
    this.func = fields.func;
  }

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<RunOutput> {
    return this._callWithConfig(
      async (input: RunInput) => this.func(input),
      input,
      options
    );
  }
}

/**
 * A runnable that passes through the input.
 */
export class RunnablePassthrough<RunInput> extends Runnable<
  RunInput,
  RunInput
> {
  static lc_name() {
    return "RunnablePassthrough";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<RunInput> {
    return this._callWithConfig(
      (input: RunInput) => Promise.resolve(input),
      input,
      options
    );
  }
}

/**
 * A runnable that delegates calls to another runnable with a set of kwargs.
 */
export class RunnableBinding<
  RunInput,
  RunOutput,
  CallOptions extends BaseCallbackConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  static lc_name() {
    return "RunnableBinding";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  protected bound: Runnable<RunInput, RunOutput, CallOptions>;

  protected kwargs: Partial<CallOptions>;

  constructor(fields: {
    bound: Runnable<RunInput, RunOutput, CallOptions>;
    kwargs: Partial<CallOptions>;
  }) {
    super(fields);
    this.bound = fields.bound;
    this.kwargs = fields.kwargs;
  }

  bind(
    kwargs: Partial<CallOptions>
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    return new RunnableBinding({
      bound: this.bound,
      kwargs: { ...this.kwargs, ...kwargs },
    });
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    return this.bound.invoke(input, { ...options, ...this.kwargs });
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: { maxConcurrency?: number }
  ): Promise<RunOutput[]> {
    const mergedOptions = Array.isArray(options)
      ? options.map((individualOption) => ({
          ...individualOption,
          ...this.kwargs,
        }))
      : { ...options, ...this.kwargs };
    return this.bound.batch(inputs, mergedOptions, batchOptions);
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions> | undefined
  ): Promise<IterableReadableStream<RunOutput>> {
    return this.bound.stream(input, { ...options, ...this.kwargs });
  }
}

export type RouterInput = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
};

/**
 * A runnable that routes to a set of runnables based on Input['key'].
 * Returns the output of the selected runnable.
 */
export class RouterRunnable<
  RunInput extends RouterInput,
  RunnableInput,
  RunOutput
> extends Runnable<RunInput, RunOutput> {
  static lc_name() {
    return "RouterRunnable";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  runnables: Record<string, Runnable<RunnableInput, RunOutput>>;

  constructor(fields: {
    runnables: Record<string, Runnable<RunnableInput, RunOutput>>;
  }) {
    super(fields);
    this.runnables = fields.runnables;
  }

  async invoke(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<RunOutput> {
    const { key, input: actualInput } = input;
    const runnable = this.runnables[key];
    if (runnable === undefined) {
      throw new Error(`No runnable associated with key "${key}".`);
    }
    return runnable.invoke(actualInput, options);
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[],
    batchOptions?: { maxConcurrency?: number }
  ): Promise<RunOutput[]> {
    const keys = inputs.map((input) => input.key);
    const actualInputs = inputs.map((input) => input.input);
    const missingKey = keys.find((key) => this.runnables[key] === undefined);
    if (missingKey !== undefined) {
      throw new Error(`One or more keys do not have a corresponding runnable.`);
    }
    const runnables = keys.map((key) => this.runnables[key]);
    const optionsList = this._getOptionsList(options ?? {}, inputs.length);
    const batchSize =
      batchOptions?.maxConcurrency && batchOptions.maxConcurrency > 0
        ? batchOptions?.maxConcurrency
        : inputs.length;
    const batchResults = [];
    for (let i = 0; i < actualInputs.length; i += batchSize) {
      const batchPromises = actualInputs
        .slice(i, i + batchSize)
        .map((actualInput, i) =>
          runnables[i].invoke(actualInput, optionsList[i])
        );
      const batchResult = await Promise.all(batchPromises);
      batchResults.push(batchResult);
    }
    return batchResults.flat();
  }

  async stream(
    input: RunInput,
    options?: Partial<BaseCallbackConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    const { key, input: actualInput } = input;
    const runnable = this.runnables[key];
    if (runnable === undefined) {
      throw new Error(`No runnable associated with key "${key}".`);
    }
    return runnable.stream(actualInput, options);
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
    batchOptions?: { maxConcurrency?: number }
  ): Promise<RunOutput[]> {
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

function _coerceToRunnable<RunInput, RunOutput>(
  coerceable: RunnableLike<RunInput, RunOutput>
): Runnable<RunInput, RunOutput> {
  if (typeof coerceable === "function") {
    return new RunnableLambda({ func: coerceable });
  } else if (Runnable.isRunnable(coerceable)) {
    return coerceable;
  } else if (!Array.isArray(coerceable) && typeof coerceable === "object") {
    const runnables: Record<string, Runnable<RunInput>> = {};
    for (const [key, value] of Object.entries(coerceable)) {
      runnables[key] = _coerceToRunnable(value);
    }
    return new RunnableMap<RunInput>({ steps: runnables }) as Runnable<
      RunInput,
      RunOutput
    >;
  } else {
    throw new Error(
      `Expected a Runnable, function or object.\nInstead got an unsupported type.`
    );
  }
}
