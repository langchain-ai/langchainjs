/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */
import { AsyncLocalStorage } from "node:async_hooks";
import { RunTree } from "langsmith";
import { isRunTree } from "langsmith/run_trees";
import {
  _CONTEXT_VARIABLES_KEY,
  AsyncLocalStorageProviderSingleton,
} from "./singletons/index.js";

AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
  new AsyncLocalStorage()
);

/**
 * Set a context variable. Context variables are scoped to any
 * child runnables called by the current runnable, or globally if set outside
 * of any runnable.
 *
 * @remarks
 * This function is only supported in environments that support AsyncLocalStorage,
 * including Node.js, Deno, and Cloudflare Workers.
 *
 * @example
 * ```ts
 * import { RunnableLambda } from "@langchain/core/runnables";
 * import {
 *   getContextVariable,
 *   setContextVariable
 * } from "@langchain/core/context";
 *
 * const nested = RunnableLambda.from(() => {
 *   // "bar" because it was set by a parent
 *   console.log(getContextVariable("foo"));
 *
 *   // Override to "baz", but only for child runnables
 *   setContextVariable("foo", "baz");
 *
 *   // Now "baz", but only for child runnables
 *   return getContextVariable("foo");
 * });
 *
 * const runnable = RunnableLambda.from(async () => {
 *   // Set a context variable named "foo"
 *   setContextVariable("foo", "bar");
 *
 *   const res = await nested.invoke({});
 *
 *   // Still "bar" since child changes do not affect parents
 *   console.log(getContextVariable("foo"));
 *
 *   return res;
 * });
 *
 * // undefined, because context variable has not been set yet
 * console.log(getContextVariable("foo"));
 *
 * // Final return value is "baz"
 * const result = await runnable.invoke({});
 * ```
 *
 * @param name The name of the context variable.
 * @param value The value to set.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setContextVariable(name: PropertyKey, value: any): void {
  const runTree = AsyncLocalStorageProviderSingleton.getInstance().getStore();
  const contextVars = { ...runTree?.[_CONTEXT_VARIABLES_KEY] };
  contextVars[name] = value;
  let newValue = {};
  if (isRunTree(runTree)) {
    newValue = new RunTree(runTree);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (newValue as any)[_CONTEXT_VARIABLES_KEY] = contextVars;
  AsyncLocalStorageProviderSingleton.getInstance().enterWith(newValue);
}

/**
 * Get the value of a previously set context variable. Context variables
 * are scoped to any child runnables called by the current runnable,
 * or globally if set outside of any runnable.
 *
 * @remarks
 * This function is only supported in environments that support AsyncLocalStorage,
 * including Node.js, Deno, and Cloudflare Workers.
 *
 * @example
 * ```ts
 * import { RunnableLambda } from "@langchain/core/runnables";
 * import {
 *   getContextVariable,
 *   setContextVariable
 * } from "@langchain/core/context";
 *
 * const nested = RunnableLambda.from(() => {
 *   // "bar" because it was set by a parent
 *   console.log(getContextVariable("foo"));
 *
 *   // Override to "baz", but only for child runnables
 *   setContextVariable("foo", "baz");
 *
 *   // Now "baz", but only for child runnables
 *   return getContextVariable("foo");
 * });
 *
 * const runnable = RunnableLambda.from(async () => {
 *   // Set a context variable named "foo"
 *   setContextVariable("foo", "bar");
 *
 *   const res = await nested.invoke({});
 *
 *   // Still "bar" since child changes do not affect parents
 *   console.log(getContextVariable("foo"));
 *
 *   return res;
 * });
 *
 * // undefined, because context variable has not been set yet
 * console.log(getContextVariable("foo"));
 *
 * // Final return value is "baz"
 * const result = await runnable.invoke({});
 * ```
 *
 * @param name The name of the context variable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getContextVariable(name: PropertyKey): any {
  const runTree = AsyncLocalStorageProviderSingleton.getInstance().getStore();
  return runTree?.[_CONTEXT_VARIABLES_KEY]?.[name];
}
