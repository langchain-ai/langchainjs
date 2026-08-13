---
"@langchain/openai": patch
---

feat(openai): mark OpenAI provider errors as retryable or not

Builds on `stampRetryable` in `@langchain/core` so the retry middleware can tell a transient failure from a deterministic one. Timeouts and rate limits are marked retryable; aborts, context overflow, invalid tool results, bad credentials, and unknown models non-retryable. Anything else stays unmarked and retries as before.

Errors keep their original class, so `instanceof` against the `openai` SDK error types is unaffected.
