---
"langchain": patch
---

feat(langchain): add `modelRefusalMiddleware`

`modelRefusalMiddleware()` throws `ModelRefusalError` when the model refuses, including refusals that fail to parse under `responseFormat`, instead of ending the run as if it succeeded. List it after `modelFallbackMiddleware` so the fallback retries the refused request on the next model. `ModelRefusalError` now propagates from `wrapModelCall` and `wrapToolCall` middleware unwrapped instead of as a `MiddlewareError`, so callers can catch it directly and retry middleware sees it as non-retryable. This also applies to provider errors marked with `ModelRefusalError.markAsRefusal`. `StructuredOutputParsingError` gains an optional `aiMessage`.
