import { Runnable, RunnableBatchOptions } from "./base.js";
import { RunnableConfig } from "./config.js";
import { IterableReadableStream } from "../../util/stream.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";

type RemoteRunnableOptions = {
  timeout?: number;
};

function withoutCallbacks(
  options?: RunnableConfig
): Omit<RunnableConfig, "callbacks"> {
  const { callbacks, ...rest } = options ?? {};
  return rest;
}

export class RemoteRunnable<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  private url: string;
  private options?: RemoteRunnableOptions;

  lc_namespace = ["langchain", "schema", "runnable", "remote"];

  constructor(url: string, options?: RemoteRunnableOptions) {
    super();
    this.url = url.replace(/\/$/, ""); // remove trailing slash
    this.options = options;
  }

  private post<Body>(path: string, body: Body) {
    return fetch(`${this.url}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.options?.timeout ?? 5000),
    });
  }

  async invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput> {
    const response = await this.post<{
      input: RunInput;
      config: RunnableConfig;
      kwargs: any;
    }>("/invoke", {
      input,
      config: withoutCallbacks(options),
      kwargs: {},
    });
    return response.body as RunOutput;
  }

  async _batch(
    inputs: RunInput[],
    configs?: RunnableConfig[],
    _?: (CallbackManagerForChainRun | undefined)[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("returnExceptions is not supported for remote clients");
    }
    const response = await this.post<{
      inputs: RunInput[];
      config: (RunnableConfig & RunnableBatchOptions)[];
      kwargs: any;
    }>("/batch", {
      inputs,
      config:
        configs ??
        []
          .map(withoutCallbacks)
          .map((config) => ({ ...config, ...batchOptions })),
      kwargs: {},
    });
    const body = await response.json();

    if (!body.output) throw new Error("Invalid response from remote runnable");

    return JSON.parse(body.output);
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
      throw Error("returnExceptions is not supported for remote clients");
    }
    return this._batchWithConfig(this._batch, inputs, options, batchOptions);
  }

  async stream(
    input: RunInput,
    options?: RunnableConfig
  ): Promise<IterableReadableStream<RunOutput>> {
    const response = await this.post<{
      input: RunInput;
      options: RunnableConfig;
    }>("/stream", {
      input,
      options: options ?? {},
    });
    if (!response.ok) {
      const json = await response.json();
      const error = new Error(
        `RemoteRunnable call failed with status code ${response.status}: ${json.message}`
      );
      (error as any).response = response;
      throw error;
    }
    if (!response.body) {
      throw new Error(
        "Could not begin LangServe stream. Please check the given URL and try again."
      );
    }
    const decoder = new TextDecoder();
    const { readable, writable } = new TransformStream<Uint8Array, RunOutput>({
      transform: (chunk, controller) => {
        const decoded = decoder.decode(chunk);
        const parsed = JSON.parse(decoded);
        controller.enqueue(JSON.parse(parsed.data));
      },
    });
    response.body.pipeTo(writable);
    const stream = IterableReadableStream.fromReadableStream(readable);
    return stream;
  }
}
