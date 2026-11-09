---
"@langchain/core": patch
---

Stop `streamEvents` v2 from hanging or leaking an unhandled rejection when aborted, and from throwing its own `AbortError` when the consumer breaks early.
