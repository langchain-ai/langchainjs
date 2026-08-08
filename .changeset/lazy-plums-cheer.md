---
"@langchain/core": minor
"@langchain/google": minor
"langchain": patch
---

**`@langchain/core`**: New `ModelError` base class for errors related to model invocation/streaming/output, with an `isRetryable` property (defaults to `false`) — as opposed to a client-side `ConfigurationError` (also new, sibling to `ModelError`), which has no `isRetryable` at all since nothing was ever sent anywhere. `LangChainError` itself no longer has `isRetryable`.

Nine new/updated `ModelError` subclasses, each with a considered `isRetryable` default:

- `ModelAbortError`, `ContextOverflowError` (existing classes, now under `ModelError`): `false` — a deliberate cancellation or an input too large to fit don't change on retry.
- `AuthenticationError`: derived from the response's status code — a bad credential (400/401/403/404) is `false`, but a transient 429/5xx from the auth server itself is `true`.
- `ModelNotFoundError`, `PermissionDeniedError`, `QuotaExceededError`: `false` — all deterministic until something external changes (fixing the model ID, granting access, adding funds).
- `TimeoutError`, `RateLimitError`, `ConnectionError`, `ServerError`: `true` by default (the textbook transient cases), `false` if `partialOutput` is set (retrying would risk duplicating output already received). `RateLimitError` is also `false` when `quotaExhausted` is set — a billing/quota exhaustion doesn't resolve on retry the way a plain rate limit does.

`modelRetryMiddleware`/`toolRetryMiddleware`'s default `retryOn` now honors this: `ModelError.isInstance(error) ? error.isRetryable : true`. Unclassified errors keep retrying, unchanged from before. Array-form `retryOn` (e.g. `retryOn: [TimeoutError]`) matches via exact `error.constructor === ErrorConstructor`, not `instanceof`.

**Fixes**:

- `ContextOverflowError.fromError` previously copied only `message`/`cause`, dropping any HTTP status the wrapped error had. Since retry logic elsewhere (`AsyncCaller`) duck-types on status to decide whether to retry, a context-overflow error with no status was blindly retried up to `maxRetries` despite `isRetryable` being `false`. `fromError` now copies `status`/`statusCode` onto the new `ContextOverflowError.statusCode` field — this fixes the bug for every existing caller (`@langchain/openai`, `@langchain/anthropic`) with no change needed on their end.
- `ModelError`'s brand was a markerless `ns.brand(LangChainError)`, which reuses `LangChainError`'s own symbol rather than minting a new one — `ModelError.isInstance(error)` matched _every_ `LangChainError`, including `ConfigurationError` and any unrelated provider error (e.g. `OpenRouterError`). `defaultRetryOn` then read a nonexistent `isRetryable` off those and silently stopped retrying them. `ModelError` now has its own `"model"` marker.
- `AsyncCaller`'s `classifyRateLimitError` re-runs when it catches a thrown `RateLimitError`, but that instance doesn't carry the original response's `headers` — so a 429 whose delay came only from a `Retry-After` header (not restated in the message) was misclassified as an unretryable "capacity" case on the second pass and never retried. The classifier now trusts an already-computed `retryAfterMs` on the error instead of re-deriving it.

**`@langchain/google`**: `AuthError` and `RequestError` now extend generic `@langchain/core/errors` classes instead of `GoogleError` directly (to inherit their `isRetryable` logic), which meant they stopped satisfying `GoogleError.isInstance()`. Both are re-branded to satisfy it again; the other HTTP-status-mapped classes `RequestError.fromResponse` can return (`PermissionDeniedError`, `ModelNotFoundError`, `TimeoutError`, `RateLimitError`, `ServerError`) are plain, unbranded core instances and intentionally don't match `GoogleError.isInstance` — check `ModelError.isInstance` or the specific class for those.

**Breaking (`@langchain/google`)**: Error classification has been reworked to plug into the hierarchy above. `RequestError` is no longer the catch-all for every HTTP failure from the Gemini API — `RequestError.fromResponse` now dispatches by status code to a more specific class: 401 → `AuthError` (now extends the core `AuthenticationError`), 403 → `PermissionDeniedError`, 404 → `ModelNotFoundError`, 408 → `TimeoutError`, 429 → `RateLimitError`, 500/502/503/504 → `ServerError`. `RequestError` itself remains only as the fallback for anything else. Code doing `error instanceof RequestError` or `error.name === "RequestError"` for one of these status codes will need to check the new class instead. `RequestError.isRetryable` is also now a property, not a method — `error.isRetryable()` throws; use `error.isRetryable` (no parens).

`GoogleError` now extends the core `ModelError` (was `LangChainError` directly). Google's own `ConfigurationError` has been removed in favor of the generic `ConfigurationError` from `@langchain/core/errors`. `NoCandidatesError` and `MalformedOutputError` default to `isRetryable: true` — each has a plausible transient cause with nothing on the instance to distinguish it from a deterministic one, so retrying is the safer of the two mistakes. `InvalidToolError`, `ToolCallNotFoundError`, and `InvalidInputError` are tool/input-validation errors, not model errors — they now extend `LangChainError` directly instead of `GoogleError`, and no longer match `GoogleError.isInstance`.

Provider mapping for other `@langchain/*` model packages (OpenAI, Anthropic, etc.) is not part of this change and will follow separately.
