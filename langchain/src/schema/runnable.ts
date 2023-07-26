import { Callbacks } from "../callbacks";

export type RunnableConfig = {
  tags?: string[];
  metadata?: Record<string, any>;
  callbacks?: Callbacks;
};

export abstract class Runnable<Input, Output> {

  abstract invoke(input: Input, config?: RunnableConfig): Promise<Output>;

  protected static getConfigList(config: RunnableConfig | RunnableConfig[] = {}, length = 0): RunnableConfig[] {
    if (Array.isArray(config)) {
      if (config.length !== length) {
        throw new Error(`Passed "config" must be an array with the same length as the inputs, but got ${config.length} configs for ${length} inputs`);
      }
      return config
    }
    return Array.from({length}, () => config);
  }

  async batch(inputs: Input[], config?: RunnableConfig | RunnableConfig[], _options?: {
    maxConcurrency?: number;
  }): Promise<Output[]> {
    const configList = Runnable.getConfigList(config, inputs.length);
    const promises = inputs.map((input, i) => {
      return this.invoke.bind(this, input, configList[i]);
    });
    return Promise.all(promises);
  }

  async *stream(input: Input, config?: RunnableConfig) {
    yield this.invoke(input, config);
  }
}