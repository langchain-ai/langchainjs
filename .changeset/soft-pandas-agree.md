---
"@langchain/anthropic": patch
---

feat(anthropic): mark Anthropic provider errors as retryable or not

Builds on `stampRetryable` in `@langchain/core` so the retry middleware can tell a transient failure from a deterministic one. Rate limits are marked retryable; context overflow, invalid tool results, bad credentials, and unknown models non-retryable. Anything else stays unmarked and retries as before.

Errors keep their original class, so `instanceof` against the `@anthropic-ai/sdk` error types is unaffected.
