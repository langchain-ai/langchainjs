import { BaseCallbackConfig, CallbackManager } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";

export type RunnableConfig = BaseCallbackConfig;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _coerceToDict(value: any, defaultKey: string) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value
    : { [defaultKey]: value };
}

export abstract class Runnable<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Serializable {
  abstract invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput>;

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
        .map((input, i) => this.invoke(input, configList[i]));
      const batchResult = await Promise.all(batchPromises);
      batchResults.push(batchResult);
    }
    return batchResults.flat();
  }

  async *_streamIterator(
    input: RunInput,
    options: Partial<CallOptions> = {}
  ): AsyncGenerator<RunOutput> {
    yield this.invoke(input, options);
  }

  async stream(
    input: RunInput,
    options: Partial<CallOptions> = {}
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
    options?: RunnableConfig
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
      _coerceToDict(input, "input")
    );
    let output;
    try {
      output = func.bind(this)(input);
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(_coerceToDict(output, "output"));
    return output;
  }

  _patchConfig(
    config: Partial<CallOptions>,
    callbackManager?: CallbackManager
  ): Partial<CallOptions> {
    return { ...config, callbacks: callbackManager };
  }

  pipe<NewRunOutput>(
    runnable: Runnable<RunOutput, NewRunOutput>
  ): RunnableSequence<RunInput, NewRunOutput> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return RunnableSequence.fromRunnables<RunInput, NewRunOutput>([
      this,
      runnable,
    ]);
  }
}

export class RunnableSequence<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected first: Runnable<RunInput, any, CallOptions>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected middle: Runnable<any, any, CallOptions>[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected last: Runnable<any, RunOutput, CallOptions>;

  lc_serializable = true;

  lc_namespace = ["schema", "runnable"];

  constructor(fields: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    first: Runnable<RunInput, any, CallOptions>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    middle: Runnable<any, any, CallOptions>[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last: Runnable<any, RunOutput, CallOptions>;
  }) {
    super(fields);
    this.first = fields.first;
    this.middle = fields.middle;
    this.last = fields.last;
  }

  get steps() {
    return [this.first, ...this.middle, this.last];
  }

  static fromRunnables<RunSequenceInput, RunSequenceOutput>(
    runnables: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Runnable<RunSequenceInput, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...Runnable<any, any>[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Runnable<any, RunSequenceOutput>
    ]
  ) {
    if (runnables.length < 2) {
      throw new Error("A runnable sequence must have at least two items.");
    }
    return new RunnableSequence<RunSequenceInput, RunSequenceOutput>({
      first: runnables[0],
      middle: runnables.slice(1, -1),
      last: runnables[runnables.length - 1],
    });
  }

  async invoke(
    input: RunInput,
    options: Partial<CallOptions> = {}
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
    options?: Partial<CallOptions> | Partial<CallOptions>[],
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
    let nextStepInputs = inputs;
    let finalOutputs: RunOutput[];
    try {
      for (let i = 0; i < [this.first, ...this.middle].length; i += 1) {
        const step = this.steps[i];
        nextStepInputs = await step.batch(
          nextStepInputs,
          runManagers.map(
            (runManager) =>
              this._patchConfig(configList[i], runManager?.getChild()),
            batchOptions
          )
        );
      }
      finalOutputs = await this.last.batch(
        nextStepInputs,
        runManagers.map(
          (runManager) =>
            this._patchConfig(
              configList[this.steps.length - 1],
              runManager?.getChild()
            ),
          batchOptions
        )
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
    options: Partial<CallOptions> = {}
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
    try {
      for (const step of [this.first, ...this.middle]) {
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
      const iterator = await this.last._streamIterator(
        nextStepInput,
        this._patchConfig(options, runManager?.getChild())
      );
      for await (const chunk of iterator) {
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
}
