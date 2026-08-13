---
"@langchain/google": minor
---

feat(google): mark Google provider errors as retryable or not

Builds on `stampRetryable` in `@langchain/core` so the retry middleware can tell a transient failure from a deterministic one. Timeouts, rate limits, and server errors are marked retryable; bad credentials, blocked prompts, invalid tools, and invalid input non-retryable. Errors that may succeed on a regeneration stay unmarked and retry as before.

The `@langchain/core` peer range moves from `^1.0.0` to `workspace:^`, since this release depends on `stampRetryable`.
