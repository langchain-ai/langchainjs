---
"@langchain/core": patch
---

Preserve the underlying HTTP status in `ContextOverflowError.fromError` so retry logic and callers can still inspect it
