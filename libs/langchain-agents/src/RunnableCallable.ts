import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import {
  mergeConfigs,
  patchConfig,
  Runnable,
  RunnableConfig,
} from "@langchain/core/runnables";
import { AsyncLocalStorageProviderSingleton } from "@langchain/core/singletons";
// import { ensureLangGraphConfig } from "@langchain/langgraph";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RunnableCallableArgs extends Partial<any> {
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (...args: any[]) => any;
  tags?: string[];
  trace?: boolean;
  recurse?: boolean;
}

export class RunnableCallable<I = unknown, O = unknown> extends Runnable<I, O> {
  lc_namespace: string[] = ["langgraph"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (...args: any[]) => any;

  tags?: string[];

  config?: RunnableConfig;

  trace: boolean = true;

  recurse: boolean = true;

  constructor(fields: RunnableCallableArgs) {
    super();
    this.name = fields.name ?? fields.func.name;
    this.func = fields.func;
    this.config = fields.tags ? { tags: fields.tags } : undefined;
    this.trace = fields.trace ?? this.trace;
    this.recurse = fields.recurse ?? this.recurse;
  }

  protected async _tracedInvoke(
    input: I,
    config?: Partial<RunnableConfig>,
    runManager?: CallbackManagerForChainRun
  ) {
    return new Promise<O>((resolve, reject) => {
      const childConfig = patchConfig(config, {
        callbacks: runManager?.getChild(),
      });
      void AsyncLocalStorageProviderSingleton.runWithConfig(
        childConfig,
        async () => {
          try {
            const output = await this.func(input, childConfig);
            resolve(output);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  async invoke(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: I,
    _options?: Partial<RunnableConfig> | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<O> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let returnValue: any;
    const config = {}; // ensureLangGraphConfig(options);
    const mergedConfig = mergeConfigs(this.config, config);

    if (this.trace) {
      returnValue = await this._callWithConfig(
        this._tracedInvoke,
        input,
        mergedConfig
      );
    } else {
      returnValue = await AsyncLocalStorageProviderSingleton.runWithConfig(
        mergedConfig,
        async () => this.func(input, mergedConfig)
      );
    }

    if (Runnable.isRunnable(returnValue) && this.recurse) {
      return await AsyncLocalStorageProviderSingleton.runWithConfig(
        mergedConfig,
        async () => returnValue.invoke(input, mergedConfig)
      );
    }

    return returnValue;
  }
}
