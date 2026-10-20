---
"@langchain/core": patch
---

Run background callbacks in the async context of the code that queued them, so handlers that read `AsyncLocalStorage` (such as OpenTelemetry context) no longer see another concurrent caller's values.
