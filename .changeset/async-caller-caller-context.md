---
"@langchain/core": patch
---

Run calls queued by `AsyncCaller` (when `maxConcurrency` is reached) in the async context of the code that made them, so `AsyncLocalStorage` readers such as OpenTelemetry, request-scoped loggers or auth no longer see another concurrent caller's values.
