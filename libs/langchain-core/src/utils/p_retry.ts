// p-retry is ESM-only, so we use dynamic import for CJS compatibility.
// The module is cached after first import, so subsequent calls are essentially free.
// This approach is recommended by the p-retry author for async contexts:
// https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c
let pRetryModule: typeof import("p-retry") | null = null;

export async function getPRetry() {
  if (!pRetryModule) {
    pRetryModule = await import("p-retry");
  }
  return pRetryModule.default;
}
