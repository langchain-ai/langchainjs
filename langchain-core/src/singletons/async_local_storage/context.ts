import { isRunTree, RunTree } from "langsmith/run_trees";
import { BaseCallbackHandler } from "../../callbacks/base.js";
import {
  _CONTEXT_VARIABLES_KEY,
  getGlobalAsyncLocalStorageInstance,
} from "./globals.js";

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
export function setContextVariable<T>(name: PropertyKey, value: T): void {
  // Avoid using global singleton due to circuluar dependency issues
  const asyncLocalStorageInstance = getGlobalAsyncLocalStorageInstance();
  if (asyncLocalStorageInstance === undefined) {
    throw new Error(
      `Internal error: Global shared async local storage instance has not been initialized.`
    );
  }
  const runTree = asyncLocalStorageInstance.getStore();
  const contextVars = { ...runTree?.[_CONTEXT_VARIABLES_KEY] };
  contextVars[name] = value;
  let newValue = {};
  if (isRunTree(runTree)) {
    newValue = new RunTree(runTree);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (newValue as any)[_CONTEXT_VARIABLES_KEY] = contextVars;
  asyncLocalStorageInstance.enterWith(newValue);
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
export function getContextVariable<T = any>(name: PropertyKey): T | undefined {
  // Avoid using global singleton due to circuluar dependency issues
  const asyncLocalStorageInstance = getGlobalAsyncLocalStorageInstance();
  if (asyncLocalStorageInstance === undefined) {
    return undefined;
  }
  const runTree = asyncLocalStorageInstance.getStore();
  return runTree?.[_CONTEXT_VARIABLES_KEY]?.[name];
}

const LC_CONFIGURE_HOOKS_KEY = Symbol("lc:configure_hooks");

export const _getConfigureHooks = () =>
  getContextVariable<ConfigureHook[]>(LC_CONFIGURE_HOOKS_KEY) || [];

/**
 * Register a callback configure hook to automatically add callback handlers to all runs.
 *
 * There are two ways to use this:
 *
 * 1. Using a context variable:
 *    - Set `contextVar` to specify the variable name
 *    - Use `setContextVariable()` to store your handler instance
 *
 * 2. Using an environment variable:
 *    - Set both `envVar` and `handlerClass`
 *    - The handler will be instantiated when the env var is set to "true".
 *
 * @example
 * ```typescript
 * // Method 1: Using context variable
 * import {
 *   registerConfigureHook,
 *   setContextVariable
 * } from "@langchain/core/context";
 *
 * const tracer = new MyCallbackHandler();
 * registerConfigureHook({
 *   contextVar: "my_tracer",
 * });
 * setContextVariable("my_tracer", tracer);
 *
 * // ...run code here
 *
 * // Method 2: Using environment variable
 * registerConfigureHook({
 *   handlerClass: MyCallbackHandler,
 *   envVar: "MY_TRACER_ENABLED",
 * });
 * process.env.MY_TRACER_ENABLED = "true";
 *
 * // ...run code here
 * ```
 *
 * @param config Configuration object for the hook
 * @param config.contextVar Name of the context variable containing the handler instance
 * @param config.inheritable Whether child runs should inherit this handler
 * @param config.handlerClass Optional callback handler class (required if using envVar)
 * @param config.envVar Optional environment variable name to control handler activation
 */
export const registerConfigureHook = (config: ConfigureHook) => {
  if (config.envVar && !config.handlerClass) {
    throw new Error(
      "If envVar is set, handlerClass must also be set to a non-None value."
    );
  }
  setContextVariable(LC_CONFIGURE_HOOKS_KEY, [..._getConfigureHooks(), config]);
};

export type ConfigureHook = {
  contextVar?: string;
  inheritable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlerClass?: new (...args: any[]) => BaseCallbackHandler;
  envVar?: string;
};
