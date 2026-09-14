---
"@langchain/core": patch
---

Make `EventStreamCallbackHandler` end handlers idempotent so duplicate handler delivery in nested graph runs no longer throws "Run ID not found in run map" warnings
