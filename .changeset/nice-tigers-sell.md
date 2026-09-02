---
"langchain": patch
---

Fix `MiddlewareError.wrap` to preserve the wrapped error's prototype chain and own properties, so `modelRetryMiddleware`'s documented `retryOn` forms keep working when the error is wrapped by other middleware.
