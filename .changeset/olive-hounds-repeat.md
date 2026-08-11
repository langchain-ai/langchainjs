---
"@langchain/core": minor
"langchain": minor
---

feat(core): mark errors as retryable or not, and stop retrying the ones that aren't

Retry middleware had no way to tell a transient failure (rate limit, timeout, 5xx) from a deterministic one (bad API key, unknown model, oversized input). Everything was retried up to `maxRetries`, so a typo'd API key cost three identical round trips before surfacing.

**`@langchain/core`** gains two functions from `@langchain/core/errors`:

```ts
import { stampRetryable, getRetryable } from "@langchain/core/errors";

if (e.status === 429) throw stampRetryable(e, true);
if (e.status === 401) throw stampRetryable(e, false);

getRetryable(error); // true | false | undefined
```

`stampRetryable` sets a non-enumerable `Symbol.for("langchain.errors.retryable")` property directly on the error. The error's class, prototype, fields, and JSON serialization are untouched, so a provider SDK's own error can be marked in place and `error instanceof SomeSdkError` keeps working exactly as before. The symbol comes from the global registry, so duplicate copies of `@langchain/core` in one dependency tree agree on it.

`getRetryable` follows the `.cause` chain, so a marked error that was later rewrapped is still recognized. It returns `undefined` for errors that were never classified — callers must supply their own default (`getRetryable(error) ?? true`) rather than relying on truthiness, which would silently treat every unclassified error as non-retryable.

`ModelAbortError` and `ContextOverflowError` are now marked non-retryable at construction. `AsyncCaller` marks what it already classifies: the `STATUS_NO_RETRY` codes (400, 401, 402, 403, 404, 405, 406, 407, 409), aborted calls, and exhausted quota as non-retryable; rate limits as retryable. It previously acted on these internally and then threw, leaving an outer retry loop to repeat the whole call with no idea the verdict had already been reached.

**`langchain`**: the default `retryOn` for `modelRetryMiddleware` and `toolRetryMiddleware` changes from "retry everything" to `getRetryable(error) ?? true`.

**Behavior change:** errors explicitly marked non-retryable now fail on the first attempt instead of being retried. Unclassified errors — including any from third-party integrations or custom tools — still retry exactly as before. An explicit `retryOn` is unaffected. To restore the old behavior, pass `retryOn: () => true`.
