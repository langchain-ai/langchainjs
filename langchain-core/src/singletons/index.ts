/* eslint-disable @typescript-eslint/no-explicit-any */

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
      (globalThis as any).__lc_tracing_async_local_storage ??
      mockAsyncLocalStorage
    );
  }

  initializeGlobalInstance(instance: AsyncLocalStorageInterface) {
    if ((globalThis as any).__lc_tracing_async_local_storage === undefined) {
      (globalThis as any).__lc_tracing_async_local_storage = instance;
    }
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton };
