/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */

/**
 * This file exists as a convenient public entrypoint for functionality
 * related to context variables.
 *
 * Because it automatically initializes AsyncLocalStorage, internal
 * functionality SHOULD NEVER import from this file outside of tests.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { AsyncLocalStorageProviderSingleton } from "./singletons/index.js";
import {
  getContextVariable,
  setContextVariable,
  type ConfigureHook,
  registerConfigureHook,
} from "./singletons/async_local_storage/context.js";

AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
  new AsyncLocalStorage()
);

export {
  getContextVariable,
  setContextVariable,
  registerConfigureHook,
  type ConfigureHook,
};

export const foo = "bar";
