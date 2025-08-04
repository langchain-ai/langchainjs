/**
 * Race a promise with an abort signal. If the signal is aborted, the promise will
 * be rejected with the error from the signal. If the promise is rejected, the signal will be aborted.
 *
 * @param promise - The promise to race.
 * @param signal - The abort signal.
 * @returns The result of the promise.
 */
export async function raceWithSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (signal === undefined) {
    return promise;
  }
  let listener: () => void;
  return Promise.race([
    promise.catch<T>((err) => {
      if (!signal?.aborted) {
        throw err;
      } else {
        return undefined as T;
      }
    }),
    new Promise<never>((_, reject) => {
      listener = () => {
        reject(getAbortSignalError(signal));
      };
      signal.addEventListener("abort", listener);
      // Must be here inside the promise to avoid a race condition
      if (signal.aborted) {
        reject(getAbortSignalError(signal));
      }
    }),
  ]).finally(() => signal.removeEventListener("abort", listener));
}

/**
 * Get the error from an abort signal. Since you can set the reason to anything,
 * we have to do some type gymnastics to get a proper error message.
 *
 * @param signal - The abort signal.
 * @returns The error from the abort signal.
 */
export function getAbortSignalError(signal?: AbortSignal) {
  // eslint-disable-next-line no-instanceof/no-instanceof
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }

  if (typeof signal?.reason === "string") {
    return new Error(signal.reason);
  }

  return new Error("Aborted");
}
