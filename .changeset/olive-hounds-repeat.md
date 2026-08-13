---
"@langchain/core": minor
"langchain": minor
---

feat(core): mark errors as retryable or not, and stop retrying the ones that aren't

Retry middleware retried every failure up to `maxRetries`, including deterministic ones like a bad API key or an unknown model. Retries also nest, so a single such failure could cost dozens of API calls.

`@langchain/core/errors` adds `stampRetryable(error, retryable)` and `getRetryable(error)`. Marking an error leaves its class and shape untouched, so a provider SDK error can be classified without breaking `instanceof`. `getRetryable` returns `undefined` for errors nobody classified, and both are exported so tool authors can mark their own failures.

`modelRetryMiddleware` and `toolRetryMiddleware` now respect the mark by default, and retries stop as soon as one is found rather than each layer spending its own budget. Aborted calls, context overflow, and oversized payloads are marked non-retryable out of the box.

**Behavior change:** errors marked non-retryable now fail on the first attempt. Unclassified errors — including any from third-party integrations or custom tools — retry exactly as before. Pass `retryOn: () => true` to restore the old default. A custom `onFailedAttempt` replaces the built-in handler and opts out of marking.
