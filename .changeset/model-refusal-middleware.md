---
"langchain": patch
---

feat(langchain): add `modelRefusalMiddleware`

`modelRefusalMiddleware()` throws `ModelRefusalError` when the model refuses, instead of ending the run as if it succeeded. Middleware now passes `ModelRefusalError` through unwrapped instead of as a `MiddlewareError`.
