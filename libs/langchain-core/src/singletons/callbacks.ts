/* eslint-disable @typescript-eslint/no-explicit-any */

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
    // eslint-disable-next-line no-void
    void queue.add(async () => {
      const asyncLocalStorageInstance = getGlobalAsyncLocalStorageInstance();
      if (asyncLocalStorageInstance !== undefined) {
        await asyncLocalStorageInstance.run(undefined, async () => promiseFn());
      } else {
        await promiseFn();
      }
    });
  }
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
