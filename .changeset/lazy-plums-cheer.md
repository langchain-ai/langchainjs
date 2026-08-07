---
"@langchain/core": patch
"@langchain/google": minor
"langchain": patch
---

**Breaking (`@langchain/google`)**: `RequestError.isRetryable` is now a property, not a method. `error.isRetryable()` will throw `TypeError: error.isRetryable is not a function` — update call sites to `error.isRetryable` (no parens). No in-repo callers existed outside this class's own doc comments, but this is a published, external-facing API shape change, hence the minor bump.

`LangChainError` now declares an `isRetryable` property (defaults to `true`). `modelRetryMiddleware` and `toolRetryMiddleware` respect it in their default `retryOn` — a classified, non-retryable error now fails immediately instead of burning `maxRetries` attempts that could never succeed. Only affects the default; an explicit `retryOn` is unaffected.

Classified as non-retryable (`isRetryable: false`): `ModelAbortError`, `ContextOverflowError`, and in `@langchain/google`: `ConfigurationError`, `AuthError`, `PromptBlockedError`, `InvalidToolError`, `ToolCallNotFoundError`, `InvalidInputError`. `NoCandidatesError` and `MalformedOutputError` are left on the base default for now (genuinely ambiguous, still open).

Also fixes a `modelRetryMiddleware` bug: its array-form `retryOn` (e.g. `retryOn: [TimeoutError]`) matched via `error.constructor === ErrorConstructor`, so a subclass of a listed error type was never matched. Now uses `instanceof`, matching `toolRetryMiddleware`'s existing (correct) behavior.
