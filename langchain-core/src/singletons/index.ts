/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AsyncLocalStorageInterface {
  getStore: () => any | undefined;

  run: (store: any, callback: () => any) => any;
}

export class MockAsyncLocalStorage implements AsyncLocalStorageInterface {
  getStore(): any {
    return undefined;
  }

  run(_store: any, callback: () => any): any {
    callback();
  }
}

class AsyncLocalStorageProvider {
  private asyncLocalStorage: AsyncLocalStorageInterface =
    new MockAsyncLocalStorage();

  getInstance(): AsyncLocalStorageInterface {
    return this.asyncLocalStorage;
  }

  setInstance(instance: AsyncLocalStorageInterface) {
    this.asyncLocalStorage = instance;
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton };
