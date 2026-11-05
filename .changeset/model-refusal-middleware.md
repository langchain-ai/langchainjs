---
"langchain": minor
---

feat(langchain): add `modelRefusalMiddleware`

`modelRefusalMiddleware()` throws `ModelRefusalError` when the model refuses, including refusals that fail to parse under `responseFormat`, instead of ending the run as if it succeeded. List it after `modelFallbackMiddleware` so the fallback retries the refused request on the next model. `ModelRefusalError` now propagates from middleware unwrapped, so callers can catch it directly. `StructuredOutputParsingError` gains an optional `aiMessage`.
