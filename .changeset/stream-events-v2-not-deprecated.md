---
"@langchain/core": patch
"langchain": patch
---

Deprecate content-block `streamEvents()` on chat models and `streamEvents(..., { version: "v3" })` on agents. `streamEvents` with `version: "v2"` on chat models is no longer marked deprecated.
