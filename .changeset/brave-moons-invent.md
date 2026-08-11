---
"@langchain/google": minor
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/fireworks": minor
---

feat(providers): mark provider errors as retryable or not

Builds on `stampRetryable` in `@langchain/core`, so the retry middleware can tell a transient provider failure from a deterministic one. Each dispatcher marks the errors it already recognizes; the SDK's own error object is marked in place, so `instanceof` against the provider's error classes is unaffected. Statuses a dispatcher does not recognize stay unmarked and keep retrying as before.

**`@langchain/google`**: `RequestError` publishes the verdict from its existing `isRetryable()`, and `AuthError` is marked from its status code, so a bad credential is non-retryable while a transient failure of the auth endpoint itself is not. `ConfigurationError`, `PromptBlockedError`, `InvalidToolError`, `ToolCallNotFoundError`, and `InvalidInputError` are marked non-retryable. `NoCandidatesError` and `MalformedOutputError` are deliberately left unmarked, since both can resolve on a regeneration.

**`@langchain/openai`** and **`@langchain/anthropic`**: connection timeouts and rate limits retryable; user aborts, context overflow, invalid tool results, authentication failures, and unknown models non-retryable.

**`@langchain/fireworks`**: fixes `FireworksEmbeddings` throwing a plain `Error` with the HTTP status only inside the message string. With no `status` field, neither the retry middleware nor `AsyncCaller` could act on it, so a bad API key was retried to exhaustion on every embed call. The status is now a field and the error is marked; the message text is unchanged.

`@langchain/google` and `@langchain/fireworks` move their `@langchain/core` peer range from `^1.0.0` to `workspace:^`, matching `@langchain/openai` and `@langchain/anthropic`. It publishes as the core version shipped in the same release, which is the one that introduces `stampRetryable`. Left at `^1.0.0`, npm would resolve these packages against a core lacking the export, and the failure would only surface on the error path.
