---
"@langchain/core": patch
"@langchain/google": patch
---

fix(google): preserve tool call `id` and `thoughtSignature` in native stream events

Preserves tool call `id` and Gemini's `thoughtSignature` through `@langchain/google`'s native `streamEvents()` path, and widens `AIMessage`'s content-block/tool_calls sync in `@langchain/core` so `thoughtSignature` carries onto `tool_calls[i]`.
