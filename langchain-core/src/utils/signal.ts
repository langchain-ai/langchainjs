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
      // Must be inside of the promise to avoid a race condition
      if (signal.aborted) {
        return reject(new Error("Aborted"));
      }
      signal.addEventListener("abort", () => reject(new Error("Aborted")));
    }),
  ]);
}
