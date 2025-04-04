import {
  OrchestratorAbortBehavior,
  RunnableConfig,
} from "../runnables/types.js";

/**
 * Helper function to race a promise with an abort signal (used for timeouts). If
 * {@link RunnableConfig.orchestratorAbortBehavior} is
 * {@link OrchestratorAbortBehavior.THROW_IMMEDIATELY}, the promise will throw if the signal is
 * aborted. Otherwise this is a no-op and the original promise is returned.
 *
 * @param promise - The promise to race with the signal
 * @param config - The config object containing the signal and orchestratorAbortBehavior property
 * @param defaultOrchestratorAbortBehavior - The default behavior to use if config.orchestratorAbortBehavior is `undefined` (defaults to {@link OrchestratorAbortBehavior.THROW_IMMEDIATELY})
 *
 * @internal
 */
export async function raceWithSignal<T>(
  promise: Promise<T>,
  config?: Partial<RunnableConfig>,
  defaultOrchestratorAbortBehavior: OrchestratorAbortBehavior = OrchestratorAbortBehavior.THROW_IMMEDIATELY
): Promise<T> {
  const { signal, orchestratorAbortBehavior } = config ?? {};

  const resolvedOrchestratorAbortBehavior =
    orchestratorAbortBehavior ?? defaultOrchestratorAbortBehavior;

  if (
    signal === undefined ||
    resolvedOrchestratorAbortBehavior !==
      OrchestratorAbortBehavior.THROW_IMMEDIATELY
  ) {
    return promise;
  }

  return Promise.race([
    promise.catch<T>((err) => {
      if (!signal?.aborted) {
        throw err;
      } else {
        return undefined as T;
      }
    }),

    new Promise<never>((_, reject) => {
      const listener = () => {
        try {
          signal.throwIfAborted();
        } catch (e) {
          // it's a bit odd to try/catch and reject here rather than throwing directly,
          // but it's necessary to make sure that we reject with the correct error type
          reject(e);
        }
      };
      // Must be here inside the promise to avoid a race condition
      if (signal.aborted) {
        listener();
      }
      signal.addEventListener("abort", listener, { once: true });
    }),
  ]);
}

/**
 * Helper function for handling abort signals.
 *
 * @internal
 *
 * Behavior depends on the value of config.orchestratorAbortBehavior:
 *
 * - If {@link RunnableConfig.orchestratorAbortBehavior} is
 *   {@link OrchestratorAbortBehavior.PASSTHROUGH}, the function will not throw and will not check
 *   the signal.
 * - If {@link RunnableConfig.orchestratorAbortBehavior} is
 *   {@link OrchestratorAbortBehavior.COMPLETE_PENDING}, the function will return `true` if the
 *   signal is aborted, and the caller must wait for in-progress promises to complete, and call
 *   {@link AbortSignal.throwIfAborted} to throw instead of starting new promises.
 * - If {@link RunnableConfig.orchestratorAbortBehavior} is
 *   {@link OrchestratorAbortBehavior.THROW_IMMEDIATELY} or `undefined`, the function will throw.
 *
 * @param config - An object containing an optional `signal` and `orchestratorAbortBehavior` property
 * @param defaultBehavior - The default behavior to use if config.orchestratorAbortBehavior is `undefined` (defaults to {@link OrchestratorAbortBehavior.THROW_IMMEDIATELY})
 * @returns `true` if the signal is aborted, `false` otherwise
 * @throws If config.orchestratorAbortBehavior is OrchestratorAbortBehavior.THROW_IMMEDIATELY or undefined
 */
export function checkAbortSignal(
  config: Partial<RunnableConfig> | undefined,
  defaultBehavior: OrchestratorAbortBehavior = OrchestratorAbortBehavior.THROW_IMMEDIATELY
): boolean {
  const resolvedBehavior = config?.orchestratorAbortBehavior ?? defaultBehavior;
  if (resolvedBehavior === OrchestratorAbortBehavior.THROW_IMMEDIATELY) {
    config?.signal?.throwIfAborted();
    return false;
  }
  if (resolvedBehavior === OrchestratorAbortBehavior.COMPLETE_PENDING) {
    return config?.signal?.aborted ?? false;
  }
  return false;
}
