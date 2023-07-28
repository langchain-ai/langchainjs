import { BaseCallbackConfig } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";

export type RunnableConfig = BaseCallbackConfig;

export abstract class Runnable<
  RunInput,
  CallOptions extends RunnableConfig,
  RunOutput
> extends Serializable {
  abstract invoke(input: RunInput, options?: CallOptions): Promise<RunOutput>;

  protected _getOptionsList(
    options: CallOptions | CallOptions[],
    length = 0
  ): CallOptions[] {
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
    options?: CallOptions | CallOptions[],
    batchOptions?: {
      maxConcurrency?: number;
    }
  ): Promise<RunOutput[]> {
    const configList = this._getOptionsList(
      (options ?? {}) as CallOptions,
      inputs.length
    );
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

  async *_createStreamAsyncGenerator(
    input: RunInput,
    options?: CallOptions
  ): AsyncGenerator<RunOutput> {
    yield this.invoke(input, options);
  }

  async stream(
    input: RunInput,
    options?: CallOptions
  ): Promise<IterableReadableStream<RunOutput>> {
    return IterableReadableStream.fromAsyncGenerator(
      this._createStreamAsyncGenerator(input, options)
    );
  }

  // eslint-disable-next-line require-yield
  async *_createByteStreamAsyncGenerator(
    _input: RunInput,
    _options?: CallOptions
  ): AsyncGenerator<string> {
    throw new Error("Not implemented for this class.");
  }

  async byteStream(
    input: RunInput,
    options?: CallOptions
  ): Promise<IterableReadableStream<Uint8Array>> {
    return IterableReadableStream.byteStreamFromAsyncGenerator(
      this._createByteStreamAsyncGenerator(input, options)
    );
  }
}
