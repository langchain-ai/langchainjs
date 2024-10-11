import { AsyncLocalStorage } from "node:async_hooks";
import {
  _CONTEXT_VARIABLES_KEY,
  AsyncLocalStorageProviderSingleton,
} from "./singletons/index.js";

AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
  new AsyncLocalStorage()
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setContextVariable(name: PropertyKey, value: any) {
  const runTree = AsyncLocalStorageProviderSingleton.getInstance().getStore();
  if (runTree === undefined) {
    throw new Error(
      [
        "This function can only be called from within an existing run (e.g.,",
        "inside a tool, RunnableLambda, or LangGraph.js node).",
      ].join("")
    );
  }
  const contextVars = { ...runTree[_CONTEXT_VARIABLES_KEY] };
  contextVars[name] = value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (AsyncLocalStorageProviderSingleton.getInstance() as any).enterWith({
    ...runTree,
    [_CONTEXT_VARIABLES_KEY]: contextVars,
  });
}

export function getContextVariable(name: string) {
  const runTree = AsyncLocalStorageProviderSingleton.getInstance().getStore();
  return runTree?.[_CONTEXT_VARIABLES_KEY]?.[name];
}
