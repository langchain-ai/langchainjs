/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */

/**
 * Note: Uses dynamic import to support environments that don't have
 * node:async_hooks (e.g., Cloudflare Workers). In those environments,
 * a MockAsyncLocalStorage is used instead, and users must pass config explicitly.
 */

import { dispatchCustomEvent as dispatchCustomEventWeb } from "./web.js";
import { type RunnableConfig, ensureConfig } from "../../runnables/config.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/index.js";

// Use dynamic import inside an IIFE to gracefully handle environments
// without node:async_hooks (e.g., Cloudflare Workers, browsers).
// The IIFE pattern avoids top-level await, which isn't supported in CJS.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );
  } catch {
    // Environment doesn't support node:async_hooks
    // MockAsyncLocalStorage will be used via the singleton's fallback
  }
})();

/**
 * Dispatch a custom event.
 *
 * Note: this method is only supported in non-web environments
 * due to usage of async_hooks to infer config.
 *
 * If you are using this method in the browser, please import and use
 * from "@langchain/core/callbacks/dispatch/web".
 *
 * @param name The name of the custom event.
 * @param payload The data for the custom event.
 *   Ideally should be JSON serializable to avoid serialization issues downstream, but not enforced.
 * @param config Optional config object.
 *
 * @example
 * ```typescript
 * import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
 *
 * const foo = RunnableLambda.from(async (input: string) => {
 *   await dispatchCustomEvent("my_custom_event", { arbitraryField: "someval" });
 *   return input;
 * });
 *
 * const callbacks = [{
 *   handleCustomEvent: (eventName: string, payload: any) => {
 *     // Logs "my_custom_event" and { arbitraryField: "someval" }
 *     console.log(eventName, payload);
 *   }
 * }];
 *
 * await foo.invoke("hi", { callbacks })
 * ```
 */
export async function dispatchCustomEvent(
  eventName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  config?: RunnableConfig
) {
  const ensuredConfig = ensureConfig(config);
  await dispatchCustomEventWeb(eventName, payload, ensuredConfig);
}
