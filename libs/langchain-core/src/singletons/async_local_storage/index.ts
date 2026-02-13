/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AsyncLocalStorageInterface,
  getGlobalAsyncLocalStorageInstance,
  setGlobalAsyncLocalStorageInstance,
  _CONTEXT_VARIABLES_KEY,
} from "./globals.js";
import { CallbackManager } from "../../callbacks/manager.js";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";

export class MockAsyncLocalStorage implements AsyncLocalStorageInterface {
  getStore(): any {
    return undefined;
  }

  run<T>(_store: any, callback: () => T): T {
    return callback();
  }

  enterWith(_store: any) {
    return undefined;
  }
}

const mockAsyncLocalStorage = new MockAsyncLocalStorage();

const LC_CHILD_KEY = Symbol.for("lc:child_config");

type Extra = Record<PropertyKey, unknown>;
type StoreWithExtra = {
  extra?: Extra;
} & {
  [key: string]: unknown;
  [key: number]: unknown;
  [key: symbol]: unknown;
};

class AsyncLocalStorageProvider {
  getInstance(): AsyncLocalStorageInterface {
    return getGlobalAsyncLocalStorageInstance() ?? mockAsyncLocalStorage;
  }

  getRunnableConfig() {
    const storage = this.getInstance();
    // this has the runnable config
    // which means that we should also have an instance of a LangChainTracer
    // with the run map prepopulated
    return storage.getStore()?.extra?.[LC_CHILD_KEY];
  }

  runWithConfig<T>(
    config: any,
    callback: () => T,
    avoidCreatingRootRunTree?: boolean
  ): T {
    const callbackManager = CallbackManager._configureSync(
      config?.callbacks,
      undefined,
      config?.tags,
      undefined,
      config?.metadata
    );
    const storage = this.getInstance();
    const previousValue = storage.getStore();
    const parentRunId = callbackManager?.getParentRunId();

    const langChainTracer = callbackManager?.handlers?.find(
      (handler) => handler?.name === "langchain_tracer"
    ) as LangChainTracer | undefined;

    let runTree;
    if (langChainTracer && parentRunId) {
      runTree = langChainTracer.getRunTreeWithTracingConfig(parentRunId);
    } else if (!avoidCreatingRootRunTree) {
      // When tracing is disabled, constructing a LangSmith RunTree is pure overhead
      // (UUID generation, timestamp formatting, env reads). We only need an async-local
      // store to propagate runnable config to child invocations.
      runTree = { extra: {} };
    }

    if (runTree) {
      // Ensure we preserve any existing extra fields regardless of store type
      // (RunTree or lightweight object store).
      const store = runTree as StoreWithExtra;
      const existingExtra: Extra = store.extra ?? {};
      store.extra = { ...existingExtra, [LC_CHILD_KEY]: config };
    }

    if (
      previousValue !== undefined &&
      previousValue[_CONTEXT_VARIABLES_KEY] !== undefined
    ) {
      if (runTree === undefined) {
        runTree = {};
      }
      const store = runTree as StoreWithExtra;
      store[_CONTEXT_VARIABLES_KEY] = (previousValue as StoreWithExtra)[
        _CONTEXT_VARIABLES_KEY
      ];
    }

    return storage.run(runTree, callback);
  }

  initializeGlobalInstance(instance: AsyncLocalStorageInterface) {
    if (getGlobalAsyncLocalStorageInstance() === undefined) {
      setGlobalAsyncLocalStorageInstance(instance);
    }
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton, type AsyncLocalStorageInterface };
