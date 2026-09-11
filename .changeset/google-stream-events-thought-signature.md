---
"@langchain/google": patch
---

fix(google): preserve tool call `id` and `thoughtSignature` in native stream events

Preserves tool call `id` and Gemini's `thoughtSignature` through `@langchain/google`'s native `streamEvents()` path.
