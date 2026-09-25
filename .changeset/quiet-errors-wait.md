---
"@langchain/core": patch
---

fix(core): preserve HTTP status on context overflow errors

`ContextOverflowError.fromError` now keeps the provider error's HTTP status so
`AsyncCaller` does not retry non-retryable context overflow responses.
