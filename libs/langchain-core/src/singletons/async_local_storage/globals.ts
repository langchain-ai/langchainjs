/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AsyncLocalStorageInterface {
  getStore: () => any | undefined;

  run: <T>(store: any, callback: () => T) => T;

  enterWith: (store: any) => void;
}

export const TRACING_ALS_KEY = Symbol.for("ls:tracing_async_local_storage");

export const _CONTEXT_VARIABLES_KEY = Symbol.for("lc:context_variables");

export const setGlobalAsyncLocalStorageInstance = (
  instance: AsyncLocalStorageInterface
) => {
  (globalThis as any)[TRACING_ALS_KEY] = instance;
};

export const getGlobalAsyncLocalStorageInstance = ():
  | AsyncLocalStorageInterface
  | undefined => {
  return (globalThis as any)[TRACING_ALS_KEY];
};
