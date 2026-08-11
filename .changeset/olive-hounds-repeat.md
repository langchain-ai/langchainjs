---
"@langchain/core": minor
"langchain": minor
"@langchain/google": minor
"@langchain/openai": patch
"@langchain/anthropic": patch
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

**`@langchain/google`**: provider errors are now marked. `RequestError` already had an `isRetryable()` method covering 408/429/500/502/503/504 — that verdict is now published on the error itself rather than only being available to callers who knew to ask. `AuthError` is marked from its status code the same way, so a bad credential is non-retryable while a transient failure of the auth endpoint itself is not. `ConfigurationError`, `PromptBlockedError`, `InvalidToolError`, `ToolCallNotFoundError`, and `InvalidInputError` are marked non-retryable.

`NoCandidatesError` and `MalformedOutputError` are deliberately left unmarked: both can plausibly resolve on a regeneration, so they keep the existing retry behavior rather than being guessed at in either direction.

The `@langchain/core` peer range moves from a hardcoded `^1.0.0` to `workspace:^`, matching `@langchain/openai` and `@langchain/anthropic`. It publishes as the core version shipped in the same release, so the range tracks the version that actually introduces `stampRetryable`. Left at `^1.0.0`, npm would happily resolve this package against a core that lacks the export, and the failure would only surface on the error path.

**`@langchain/openai`**: `wrapOpenAIClientError` marks each branch it already dispatches on — connection timeouts retryable; user aborts, context overflow, invalid tool results, authentication failures, and unknown models non-retryable; rate limits retryable. Statuses it doesn't branch on, including 5xx, stay unmarked and keep retrying.

The branches that call `addLangChainErrorFields` mark the SDK's own error object in place, so `error instanceof OpenAI.APIError` is unaffected. The timeout and abort branches construct a fresh `Error` and discard the original status, which is why they have to be marked here — `AsyncCaller` has nothing left to classify them by.

Rate limits are marked retryable, but `wrapOpenAIClientError` runs inside `AsyncCaller`, which re-marks them non-retryable when it recognizes quota exhaustion rather than transient pressure. The more specific verdict wins.

**`@langchain/anthropic`**: `wrapAnthropicClientError` gets the same treatment — invalid tool results, authentication failures, and unknown models non-retryable; rate limits retryable; context overflow already non-retryable by construction. As with `@langchain/openai`, the SDK's own error object is marked in place, and rate limits can still be re-marked by `AsyncCaller` when it recognizes quota exhaustion.

Two differences from `@langchain/openai` worth noting. This dispatcher has no connection-timeout or user-abort branches, so those keep falling through unmarked and retrying, which is already the right behavior for a timeout. And it applies a legacy `CONTEXT_OVERFLOW` error code that the OpenAI dispatcher does not — that divergence is preserved rather than normalized away, and is now pinned by a test.

**Behavior change:** errors explicitly marked non-retryable now fail on the first attempt instead of being retried. Unclassified errors — including any from third-party integrations or custom tools — still retry exactly as before. An explicit `retryOn` is unaffected. To restore the old behavior, pass `retryOn: () => true`.
