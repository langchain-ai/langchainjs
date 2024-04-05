import {
  type BaseCallbackConfig,
  CallbackManager,
  ensureHandler,
} from "../callbacks/manager.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";

export const DEFAULT_RECURSION_LIMIT = 25;

export interface RunnableConfig extends BaseCallbackConfig {
  /**
   * Runtime values for attributes previously made configurable on this Runnable,
   * or sub-Runnables.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configurable?: Record<string, any>;

  /**
   * Maximum number of times a call can recurse. If not provided, defaults to 25.
   */
  recursionLimit?: number;

  /** Maximum number of parallel calls to make. */
  maxConcurrency?: number;
}

export async function getCallbackManagerForConfig(config?: RunnableConfig) {
  return CallbackManager.configure(
    config?.callbacks,
    undefined,
    config?.tags,
    undefined,
    config?.metadata
  );
}

export function mergeConfigs<CallOptions extends RunnableConfig>(
  ...configs: (CallOptions | RunnableConfig | undefined | null)[]
): Partial<CallOptions> {
  // We do not want to call ensureConfig on the empty state here as this may cause
  // double loading of callbacks if async local storage is being used.
  const copy: Partial<CallOptions> = {};
  for (const options of configs.filter((c): c is CallOptions => !!c)) {
    for (const key of Object.keys(options)) {
      if (key === "metadata") {
        copy[key] = { ...copy[key], ...options[key] };
      } else if (key === "tags") {
        const baseKeys: string[] = copy[key] ?? [];
        copy[key] = [...new Set(baseKeys.concat(options[key] ?? []))];
      } else if (key === "configurable") {
        copy[key] = { ...copy[key], ...options[key] };
      } else if (key === "callbacks") {
        const baseCallbacks = copy.callbacks;
        const providedCallbacks = options.callbacks;
        // callbacks can be either undefined, Array<handler> or manager
        // so merging two callbacks values has 6 cases
        if (Array.isArray(providedCallbacks)) {
          if (!baseCallbacks) {
            copy.callbacks = providedCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            copy.callbacks = baseCallbacks.concat(providedCallbacks);
          } else {
            // baseCallbacks is a manager
            const manager = baseCallbacks.copy();
            for (const callback of providedCallbacks) {
              manager.addHandler(ensureHandler(callback), true);
            }
            copy.callbacks = manager;
          }
        } else if (providedCallbacks) {
          // providedCallbacks is a manager
          if (!baseCallbacks) {
            copy.callbacks = providedCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            const manager = providedCallbacks.copy();
            for (const callback of baseCallbacks) {
              manager.addHandler(ensureHandler(callback), true);
            }
            copy.callbacks = manager;
          } else {
            // baseCallbacks is also a manager
            copy.callbacks = new CallbackManager(
              providedCallbacks._parentRunId,
              {
                handlers: baseCallbacks.handlers.concat(
                  providedCallbacks.handlers
                ),
                inheritableHandlers: baseCallbacks.inheritableHandlers.concat(
                  providedCallbacks.inheritableHandlers
                ),
                tags: Array.from(
                  new Set(baseCallbacks.tags.concat(providedCallbacks.tags))
                ),
                inheritableTags: Array.from(
                  new Set(
                    baseCallbacks.inheritableTags.concat(
                      providedCallbacks.inheritableTags
                    )
                  )
                ),
                metadata: {
                  ...baseCallbacks.metadata,
                  ...providedCallbacks.metadata,
                },
              }
            );
          }
        }
      } else {
        const typedKey = key as keyof CallOptions;
        copy[typedKey] = options[typedKey] ?? copy[typedKey];
      }
    }
  }
  return copy as Partial<CallOptions>;
}

const PRIMITIVES = new Set(["string", "number", "boolean"]);

/**
 * Ensure that a passed config is an object with all required keys present.
 *
 * Note: To make sure async local storage loading works correctly, this
 * should not be called with a default or prepopulated config argument.
 */
export function ensureConfig<CallOptions extends RunnableConfig>(
  config?: CallOptions
): CallOptions {
  const loadedConfig =
    config ?? AsyncLocalStorageProviderSingleton.getInstance().getStore();
  let empty: RunnableConfig = {
    tags: [],
    metadata: {},
    callbacks: undefined,
    recursionLimit: 25,
    runId: undefined,
  };
  if (loadedConfig) {
    empty = { ...empty, ...loadedConfig };
  }
  if (loadedConfig?.configurable) {
    for (const key of Object.keys(loadedConfig.configurable)) {
      if (
        PRIMITIVES.has(typeof loadedConfig.configurable[key]) &&
        !empty.metadata?.[key]
      ) {
        if (!empty.metadata) {
          empty.metadata = {};
        }
        empty.metadata[key] = loadedConfig.configurable[key];
      }
    }
  }
  return empty as CallOptions;
}

/**
 * Helper function that patches runnable configs with updated properties.
 */
export function patchConfig<CallOptions extends RunnableConfig>(
  config: Partial<CallOptions> = {},
  {
    callbacks,
    maxConcurrency,
    recursionLimit,
    runName,
    configurable,
    runId,
  }: RunnableConfig = {}
): Partial<CallOptions> {
  const newConfig = ensureConfig(config);
  if (callbacks !== undefined) {
    /**
     * If we're replacing callbacks we need to unset runName
     * since that should apply only to the same run as the original callbacks
     */
    delete newConfig.runName;
    newConfig.callbacks = callbacks;
  }
  if (recursionLimit !== undefined) {
    newConfig.recursionLimit = recursionLimit;
  }
  if (maxConcurrency !== undefined) {
    newConfig.maxConcurrency = maxConcurrency;
  }
  if (runName !== undefined) {
    newConfig.runName = runName;
  }
  if (configurable !== undefined) {
    newConfig.configurable = { ...newConfig.configurable, ...configurable };
  }
  if (runId !== undefined) {
    delete newConfig.runId;
  }
  return newConfig;
}
