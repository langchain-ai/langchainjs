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

class AsyncLocalStorageProvider<
  T extends new (...args: any[]) => AsyncLocalStorageInterface
> {
  private asyncLocalStorageClass: T = MockAsyncLocalStorage as T;

  getClass(): T {
    return this.asyncLocalStorageClass;
  }

  setClass(newClass: T) {
    this.asyncLocalStorageClass = newClass;
  }
}

const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();

export { AsyncLocalStorageProviderSingleton };
