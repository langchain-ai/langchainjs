export class RemoteRunnable<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> {}

import { Runnable, RunnableConfig } from "langchain/schema/runnable";
import { RunnableBatchOptions } from "./base.js";

type RemoteRunnableOptions = {
  timeout?: number;
};

function configWithoutCallbacks<T extends RunnableConfig>(
  options: T
): Omit<T, "callbacks"> {
  const { callbacks, ...rest } = options;
  return rest;
}

function withoutCallbacks<T extends RunnableConfig>(
  options?: T | T[]
): Omit<T, "callbacks"> | Omit<T, "callbacks">[] {
  if (Array.isArray(options)) {
    return options.map(configWithoutCallbacks);
  }
  if (!options) {
    return {} as Omit<T, "callbacks">;
  }
  return configWithoutCallbacks(options);
}

export class RemoteRunnable<Input, Output> extends Runnable<Input, Output> {
  private url: string;
  private options?: RemoteRunnableOptions;

  constructor(url: string, options?: RemoteRunnableOptions) {
    super();
    this.url = url.replace(/\/$/, ""); // remove trailing slash
    this.options = options;
  }

  private post<Body>(path: string, body: Body) {
    return fetch(`${this.url}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async invoke(input: Input, options?: RunnableConfig): Promise<Output> {
    const response = await this.post<{
      input: Input;
      config: RunnableConfig;
      kwargs: any;
    }>("/invoke", {
      input,
      config: withoutCallbacks<RunnableConfig>(options) as RunnableConfig,
      kwargs: {},
    });
    return response.body as Output;
  }

  async batch(
    inputs: Input[],
    options?: RunnableConfig | RunnableConfig[],
    batchOptions?: RunnableBatchOptions
  ): Promise<Output[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("returnExceptions is not supported for remote clients");
    }
    const response = await this.post<{
      inputs: Input[];
      config:
        | (RunnableConfig & RunnableBatchOptions)
        | (RunnableConfig & RunnableBatchOptions)[];
      kwargs: any;
    }>("/batch", {
      inputs,
      config: withoutCallbacks({ ...options, ...batchOptions }),
      kwargs: {},
    });
    return response.body as Output[];
  }

  async *stream(input: Input, options?: RunnableConfig) {
    const stream = this.client.stream("/stream", {
      method: "POST",
      body: {
        input: input,
        options: options,
      },
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
