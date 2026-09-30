---
"langchain": patch
---

`modelRetryMiddleware` now retries errors that are subclasses of a class listed in `retryOn`. Previously the array form matched only the exact constructor, so `retryOn: [APIError]` never retried a `RateLimitError`. This matches `toolRetryMiddleware`.
