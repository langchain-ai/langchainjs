/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */

/**
 * This file exists as a convenient public entrypoint for functionality
 * related to context variables.
 *
 * Because it automatically initializes AsyncLocalStorage, internal
 * functionality SHOULD NEVER import from this file outside of tests.
 *
 * Note: Uses dynamic import to support environments that don't have
 * node:async_hooks (e.g., Cloudflare Workers). In those environments,
 * a MockAsyncLocalStorage is used instead.
 */

import { AsyncLocalStorageProviderSingleton } from "./singletons/index.js";
import {
  getContextVariable,
  setContextVariable,
  type ConfigureHook,
  registerConfigureHook,
} from "./singletons/async_local_storage/context.js";

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

export {
  getContextVariable,
  setContextVariable,
  registerConfigureHook,
  type ConfigureHook,
};

export const foo = "bar";
