import { BaseCallbackConfig } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";

export type RunnableConfig = BaseCallbackConfig;

export abstract class Runnable<
  RunInput,
  CallOptions,
  RunOutput
> extends Serializable {
  abstract invoke(
    input: RunInput,
    options?: CallOptions,
    config?: RunnableConfig
  ): Promise<RunOutput>;

  protected static getConfigList(
    config: RunnableConfig | RunnableConfig[] = {},
    length = 0
  ): RunnableConfig[] {
    if (Array.isArray(config)) {
      if (config.length !== length) {
        throw new Error(
          `Passed "config" must be an array with the same length as the inputs, but got ${config.length} configs for ${length} inputs`
        );
      }
      return config;
    }
    return Array.from({ length }, () => config);
  }

  async batch(
    inputs: RunInput[],
    options: CallOptions[],
    configs?: RunnableConfig | RunnableConfig[],
    _options?: {
      maxConcurrency?: number;
    }
  ): Promise<RunOutput[]> {
    const configList = Runnable.getConfigList(configs, inputs.length);
    const promises = inputs.map((input, i) =>
      this.invoke(input, options[i], configList[i])
    );
    return Promise.all(promises);
  }

  async *_createAsyncGenerator(
    input: RunInput,
    options?: CallOptions,
    config?: RunnableConfig
  ): AsyncGenerator<RunOutput> {
    yield this.invoke(input, options, config);
  }

  async stream(
    input: RunInput,
    options?: CallOptions,
    config?: RunnableConfig
  ): Promise<IterableReadableStream<RunOutput>> {
    const generator = await this._createAsyncGenerator(input, options, config);
    const outputStream = new IterableReadableStream<RunOutput>({
      async pull(controller) {
        const yieldedValue = await generator.next();
        controller.enqueue(yieldedValue.value);
        if (yieldedValue.done) {
          controller.close();
        }
      },
    });
    return outputStream;
  }
}
