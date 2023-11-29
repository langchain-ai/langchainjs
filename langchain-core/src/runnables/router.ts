import { Runnable, type RunnableBatchOptions } from "./base.js";
import { IterableReadableStream } from "../utils/stream.js";
import type { RunnableConfig } from "./config.js";

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

  lc_namespace = ["langchain_core", "runnables"];

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
    options?: Partial<RunnableConfig>
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
    options?: Partial<RunnableConfig>
  ): Promise<IterableReadableStream<RunOutput>> {
    const { key, input: actualInput } = input;
    const runnable = this.runnables[key];
    if (runnable === undefined) {
      throw new Error(`No runnable associated with key "${key}".`);
    }
    return runnable.stream(actualInput, options);
  }
}
