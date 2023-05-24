import PQueueMod from "p-queue";

const PQueue =
  "default" in PQueueMod ? /* #__PURE__ */ PQueueMod.default : PQueueMod;
const queue = /* #__PURE__ */ new PQueue({
  autoStart: true,
});

/**
 * Consume a promise, either adding it to the queue or waiting for it to resolve
 * @param promise Promise to consume
 * @param wait Whether to wait for the promise to resolve or resolve immediately
 */
export async function consumeCallback<T>(
  promiseFn: () => Promise<T> | T | void,
  wait: boolean
): Promise<void> {
  if (wait === true) {
    await promiseFn();
  } else {
    void queue.add(promiseFn);
  }
}

export function awaitAllCallbacks(): Promise<void> {
  return queue.onIdle();
}
