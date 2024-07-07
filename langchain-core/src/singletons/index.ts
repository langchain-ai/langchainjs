/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunTree } from "langsmith";
import { isTracingEnabled } from "../utils/callbacks.js";
import { CallbackManager } from "../callbacks/manager.js";

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
    return storage.getStore()?.extra?._lc_runnable_config;
  }

  runWithConfig<T>(config: any, callback: () => T): T {
    const callbackManager = CallbackManager._configureSync(
      config?.callbacks,
      undefined,
      config?.tags,
      undefined,
      config?.metadata
    );
    const parentRunId = callbackManager?.getParentRunId();
    const handlers = callbackManager?.handlers;
    const storage = this.getInstance();
    const currentRunTree = storage.getStore();
    let newRunTree;
    if (currentRunTree !== undefined && currentRunTree.id === config?.run_id) {
      newRunTree = currentRunTree;
      newRunTree.extra = {
        ...newRunTree.extra,
        _lc_runnable_config: config,
      };
    } else {
      const langChainTracer: any = handlers?.find(
        (handler) => handler?.name === "langchain_tracer"
      );
      const tracingEnabled = isTracingEnabled() || !!langChainTracer;
      const parentRun = langChainTracer?.getRun?.(parentRunId);
      const projectName = langChainTracer?.projectName;
      const client = langChainTracer?.client;
      newRunTree = new RunTree({
        client,
        tracingEnabled,
        id: config?.run_id,
        parent_run_id: parentRun?.id,
        project_name: projectName,
        name: config?.runName ?? "<langchain_runnable>",
        extra: {
          metadata: { ...config?.metadata },
          _lc_runnable_config: config,
        },
      });
    }
    return storage.run(newRunTree, callback);
  }

  initializeGlobalInstance(instance: AsyncLocalStorageInterface) {
    if ((globalThis as any).__lc_tracing_async_local_storage_v2 === undefined) {
      (globalThis as any).__lc_tracing_async_local_storage_v2 = instance;
    }
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton };
