/* oxlint-disable @typescript-eslint/no-explicit-any */

import PQueueMod from "p-queue";
import { getGlobalAsyncLocalStorageInstance } from "./async_local_storage/globals.js";
import { getDefaultLangChainClientSingleton } from "./tracer.js";

let queue: (typeof import("p-queue"))["default"]["prototype"];

/**
 * Creates a queue using the p-queue library. The queue is configured to
 * auto-start and has a concurrency of 1, meaning it will process tasks
 * one at a time.
 */
function createQueue() {
  const PQueue: any = "default" in PQueueMod ? PQueueMod.default : PQueueMod;
  return new PQueue({
    autoStart: true,
    concurrency: 1,
  });
}

export function getQueue() {
  if (typeof queue === "undefined") {
    queue = createQueue();
  }
  return queue;
}

/**
 * Consume a promise, either adding it to the queue or waiting for it to resolve
 * @param promiseFn Promise to consume
 * @param wait Whether to wait for the promise to resolve or resolve immediately
 */
export async function consumeCallback<T>(
  promiseFn: () => Promise<T> | T | void,
  wait: boolean
): Promise<void> {
  if (wait === true) {
    // Clear config since callbacks are not part of the root run
    // Avoid using global singleton due to circuluar dependency issues
    const asyncLocalStorageInstance = getGlobalAsyncLocalStorageInstance();
    if (asyncLocalStorageInstance !== undefined) {
      await asyncLocalStorageInstance.run(undefined, async () => promiseFn());
    } else {
      await promiseFn();
    }
  } else {
    queue = getQueue();
    // oxlint-disable-next-line no-void
    void queue.add(
      bindToCallerContext(async () => {
        const asyncLocalStorageInstance = getGlobalAsyncLocalStorageInstance();
        if (asyncLocalStorageInstance !== undefined) {
          await asyncLocalStorageInstance.run(undefined, async () =>
            promiseFn()
          );
        } else {
          await promiseFn();
        }
      })
    );
  }
}

type AsyncLocalStorageClass = {
  snapshot?: () => <R>(fn: () => R) => R;
};

/**
 * Binds `fn` to the async context that is active when the callback is queued.
 *
 * The queue starts a waiting task from inside the task that just finished, so
 * an unbound callback runs in that earlier caller's async context, and handlers
 * that read any `AsyncLocalStorage` (e.g. OpenTelemetry context) see another
 * caller's values. The class is taken from the registered global instance
 * because this module must not import `node:async_hooks`; without one, `fn`
 * is returned unchanged.
 */
function bindToCallerContext<T>(fn: () => Promise<T>): () => Promise<T> {
  const storageClass = getGlobalAsyncLocalStorageInstance()?.constructor as
    | AsyncLocalStorageClass
    | undefined;
  if (typeof storageClass?.snapshot !== "function") {
    return fn;
  }
  const runInCallerContext = storageClass.snapshot();
  return () => runInCallerContext(fn);
}

/**
 * Waits for all promises in the queue to resolve. If the queue is
 * undefined, it immediately resolves a promise.
 */
export async function awaitAllCallbacks(): Promise<void> {
  const defaultClient = getDefaultLangChainClientSingleton();
  await Promise.allSettled([
    typeof queue !== "undefined" ? queue.onIdle() : Promise.resolve(),
    defaultClient.awaitPendingTraceBatches(),
  ]);
}
