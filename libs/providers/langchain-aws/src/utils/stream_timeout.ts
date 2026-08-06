/** Default milliseconds to wait for the first or next Bedrock stream chunk. */
export const DEFAULT_STREAM_IDLE_TIMEOUT = 60_000;

/** Resolves stream idle timeout milliseconds; `0` disables the watchdog. */
export function resolveStreamIdleTimeout(timeout: number | undefined) {
  if (timeout === undefined || timeout === 0) {
    return undefined;
  }
  if (!Number.isFinite(timeout) || timeout < 0) {
    throw new Error(
      "streamIdleTimeout must be a non-negative finite number of milliseconds."
    );
  }
  return timeout;
}

/** Creates the catchable error thrown when Bedrock stops yielding stream chunks. */
export function createStreamIdleTimeoutError(timeout: number) {
  return new Error(
    `Bedrock Converse stream timed out after ${timeout} ms without receiving a chunk.`,
    { cause: { lc_error_code: "MODEL_STREAM_TIMEOUT" } }
  );
}

/** Creates an AbortController that follows an optional caller-provided signal. */
export function createLinkedAbortController(signal?: AbortSignal) {
  const abortController = new AbortController();
  if (!signal) {
    return { abortController, cleanup: () => undefined };
  }
  if (signal.aborted) {
    abortController.abort(signal.reason);
    return { abortController, cleanup: () => undefined };
  }
  const onAbort = () => abortController.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  return {
    abortController,
    cleanup: () => signal.removeEventListener("abort", onAbort),
  };
}

/** Wraps a stream with a first/inter-chunk idle timeout that aborts on stalls. */
export async function* withStreamIdleTimeout<T>(
  source: AsyncIterable<T>,
  timeout: number | undefined,
  abortController: AbortController
): AsyncGenerator<T> {
  if (timeout === undefined) {
    yield* source;
    return;
  }

  const iterator = source[Symbol.asyncIterator]();
  let completed = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    while (true) {
      const nextChunk = iterator.next();
      nextChunk.catch(() => undefined);
      try {
        const result = await Promise.race([
          nextChunk,
          new Promise<IteratorResult<T>>((_, reject) => {
            timeoutId = setTimeout(() => {
              const error = createStreamIdleTimeoutError(timeout);
              abortController.abort(error);
              reject(error);
            }, timeout);
          }),
        ]);

        if (result.done) {
          completed = true;
          return;
        }
        yield result.value;
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }
    }
  } finally {
    if (!completed) {
      iterator.return?.().catch(() => undefined);
    }
  }
}
