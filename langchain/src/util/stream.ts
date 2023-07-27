/*
 * Support async iterator syntax for ReadableStreams in all environments.
 * Source: https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
export function readableStreamToAsyncIterable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: any,
  preventCancel = false
) {
  if (stream[Symbol.asyncIterator]) {
    return stream[Symbol.asyncIterator]();
  }

  const reader = stream.getReader();

  return {
    async next() {
      try {
        const result = await reader.read();
        if (result.done) reader.releaseLock(); // release lock when stream becomes closed
        return result;
      } catch (e) {
        reader.releaseLock(); // release lock when stream becomes errored
        throw e;
      }
    },
    async return() {
      if (!preventCancel) {
        const cancelPromise = reader.cancel(); // cancel first, but don't await yet
        reader.releaseLock(); // release lock first
        await cancelPromise; // now await it
      } else {
        reader.releaseLock();
      }
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
