export async function raceWithSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (signal === undefined) {
    return promise;
  }
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")));
      // Must be here inside the promise to avoid a race condition
      if (signal.aborted) {
        return reject(new Error("Aborted"));
      }
    }),
  ]);
}
