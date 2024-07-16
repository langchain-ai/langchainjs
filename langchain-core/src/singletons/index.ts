/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallbackManager } from "../callbacks/manager.js";
import { LangChainTracer } from "../tracers/tracer_langchain.js";

export interface AsyncLocalStorageInterface {
  getStore: () => any | undefined;

  run: <T>(store: any, callback: () => T) => T;
}

export class MockAsyncLocalStorage implements AsyncLocalStorageInterface {
  getStore(): any {
    return undefined;
  }

  run<T>(_store: any, callback: () => T): T {
    return callback();
  }
}

const mockAsyncLocalStorage = new MockAsyncLocalStorage();

class AsyncLocalStorageProvider {
  getInstance(): AsyncLocalStorageInterface {
    return (
      (globalThis as any).__lc_tracing_async_local_storage_v2 ??
      mockAsyncLocalStorage
    );
  }

  getRunnableConfig() {
    const storage = this.getInstance();
    // this has the runnable config
    // which means that I should also have an instance of a LangChainTracer
    // with the run map prepopulated
    return storage.getStore()?.extra?.[Symbol.for("lc:child_config")];
  }

  runWithConfig<T>(config: any, callback: () => T): T {
    const callbackManager = CallbackManager._configureSync(
      config?.callbacks,
      undefined,
      config?.tags,
      undefined,
      config?.metadata
    );
    const storage = this.getInstance();
    const parentRunId = callbackManager?.getParentRunId();

    const langChainTracer = callbackManager?.handlers?.find(
      (handler) => handler?.name === "langchain_tracer"
    ) as LangChainTracer | undefined;

    const runTree =
      langChainTracer && parentRunId
        ? langChainTracer.convertToRunTree(parentRunId)
        : undefined;

    if (runTree) {
      runTree.extra = {
        ...runTree.extra,
        [Symbol.for("lc:child_config")]: config,
      };
    }

    return storage.run(runTree, callback);
  }

  initializeGlobalInstance(instance: AsyncLocalStorageInterface) {
    if ((globalThis as any).__lc_tracing_async_local_storage_v2 === undefined) {
      (globalThis as any).__lc_tracing_async_local_storage_v2 = instance;
    }
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton };
