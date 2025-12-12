import { CallbackManager, ensureHandler } from "../callbacks/manager.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import { RunnableConfig } from "./types.js";

export const DEFAULT_RECURSION_LIMIT = 25;

export { type RunnableConfig };

export async function getCallbackManagerForConfig(config?: RunnableConfig) {
  return CallbackManager._configureSync(
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
      } else if (key === "timeout") {
        if (copy.timeout === undefined) {
          copy.timeout = options.timeout;
        } else if (options.timeout !== undefined) {
          copy.timeout = Math.min(copy.timeout, options.timeout);
        }
      } else if (key === "signal") {
        if (copy.signal === undefined) {
          copy.signal = options.signal;
        } else if (options.signal !== undefined) {
          if ("any" in AbortSignal) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            copy.signal = (AbortSignal as any).any([
              copy.signal,
              options.signal,
            ]);
          } else {
            copy.signal = options.signal;
          }
        }
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
 */
export function ensureConfig<CallOptions extends RunnableConfig>(
  config?: CallOptions
): CallOptions {
  const implicitConfig = AsyncLocalStorageProviderSingleton.getRunnableConfig();
  let empty: RunnableConfig = {
    tags: [],
    metadata: {},
    recursionLimit: 25,
    runId: undefined,
  };
  if (implicitConfig) {
    // Don't allow runId and runName to be loaded implicitly, as this can cause
    // child runs to improperly inherit their parents' run ids.
    const { runId, runName, ...rest } = implicitConfig;
    empty = Object.entries(rest).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (currentConfig: Record<string, any>, [key, value]) => {
        if (value !== undefined) {
          currentConfig[key] = value;
        }
        return currentConfig;
      },
      empty
    );
  }
  if (config) {
    empty = Object.entries(config).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (currentConfig: Record<string, any>, [key, value]) => {
        if (value !== undefined) {
          currentConfig[key] = value;
        }
        return currentConfig;
      },
      empty
    );
  }
  if (empty?.configurable) {
    for (const key of Object.keys(empty.configurable)) {
      if (
        PRIMITIVES.has(typeof empty.configurable[key]) &&
        !empty.metadata?.[key]
      ) {
        if (!empty.metadata) {
          empty.metadata = {};
        }
        empty.metadata[key] = empty.configurable[key];
      }
    }
  }
  if (empty.timeout !== undefined) {
    if (empty.timeout <= 0) {
      throw new Error("Timeout must be a positive number");
    }
    const originalTimeoutMs = empty.timeout;
    const timeoutSignal = AbortSignal.timeout(originalTimeoutMs);
    // Preserve the numeric timeout for downstream consumers that need to pass
    // an explicit timeout value to underlying SDKs in addition to an AbortSignal.
    // We store it in metadata to avoid changing the public config shape.
    if (!empty.metadata) {
      empty.metadata = {};
    }
    // Do not overwrite if already set upstream.
    if (empty.metadata.timeoutMs === undefined) {
      empty.metadata.timeoutMs = originalTimeoutMs;
    }
    if (empty.signal !== undefined) {
      if ("any" in AbortSignal) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        empty.signal = (AbortSignal as any).any([empty.signal, timeoutSignal]);
      }
    } else {
      empty.signal = timeoutSignal;
    }

    /**
     * We are deleting the timeout key for the following reasons:
     * - Idempotent normalization: ensureConfig may be called multiple times down the stack. If timeout remains,
     *   each call would synthesize new timeout signals and combine them, changing the effective timeout unpredictably.
     * - Single enforcement path: downstream code relies on signal to enforce cancellation. Leaving timeout means two
     *   competing mechanisms (numeric timeout and signal) can be applied, sometimes with different semantics.
     * - Propagation to children: pickRunnableConfigKeys would keep forwarding timeout to nested runnables, causing
     *   repeated re-normalization and stacked timeouts.
     * - Backward compatibility: a lot of components and tests assume ensureConfig removes timeout post-normalization;
     *   changing that would be a breaking change.
     */
    delete empty.timeout;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickRunnableConfigKeys<CallOptions extends Record<string, any>>(
  config?: CallOptions
): Partial<RunnableConfig> | undefined {
  if (!config) return undefined;

  return {
    configurable: config.configurable,
    recursionLimit: config.recursionLimit,
    callbacks: config.callbacks,
    tags: config.tags,
    metadata: config.metadata,
    maxConcurrency: config.maxConcurrency,
    timeout: config.timeout,
    signal: config.signal,
    // @ts-expect-error - Store is a LangGraph-specific property
    // which wewant to pass through to all runnables.
    // (eg. tools should have access to writing to the store)
    store: config.store,
  };
}
