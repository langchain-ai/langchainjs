import {
  mergeConfigs,
  Runnable,
  RunnableConfig,
} from "@langchain/core/runnables";
import { AsyncLocalStorageProviderSingleton } from "@langchain/core/singletons";

export interface RunnableCallableArgs<I, O> {
  /**
   * The name of the runnable.
   */
  name?: string;
  /**
   * The function to call.
   */
  func: (...args: I[]) => O | Promise<O>;
  /**
   * The tags to add to the runnable.
   */
  tags?: string[];
  /**
   * Whether to recurse the runnable.
   */
  recurse?: boolean;
}

export class RunnableCallable<I = unknown, O = unknown> extends Runnable<I, O> {
  lc_namespace: string[] = ["langgraph"];

  func: RunnableCallableArgs<I, O>["func"];

  tags?: RunnableCallableArgs<I, O>["tags"];

  config?: RunnableConfig;

  trace = true;

  recurse = true;

  #state: Awaited<O>;

  constructor(fields: RunnableCallableArgs<I, O>) {
    super();
    this.name = fields.name ?? fields.func.name;
    this.func = fields.func;
    this.config = fields.tags ? { tags: fields.tags } : undefined;
    this.recurse = fields.recurse ?? this.recurse;
  }

  getState(): Awaited<O> {
    return this.#state;
  }

  setState(state: Awaited<O>) {
    this.#state = {
      ...this.#state,
      ...state,
    };
  }

  async invoke(
    input: I,
    options?: Partial<RunnableConfig> | undefined
  ): Promise<O> {
    const mergedConfig = mergeConfigs(this.config, options);

    const returnValue = await AsyncLocalStorageProviderSingleton.runWithConfig(
      mergedConfig,
      async () => this.func(input, mergedConfig as I)
    );

    if (Runnable.isRunnable(returnValue) && this.recurse) {
      return await AsyncLocalStorageProviderSingleton.runWithConfig(
        mergedConfig,
        async () => (returnValue as Runnable<I, O>).invoke(input, mergedConfig)
      );
    }

    this.#state = returnValue;
    return returnValue;
  }
}
