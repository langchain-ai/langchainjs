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

export function getAbortSignalError(signal?: AbortSignal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : typeof signal?.reason === "string"
    ? new Error(signal.reason)
    : new Error("Aborted");
}
