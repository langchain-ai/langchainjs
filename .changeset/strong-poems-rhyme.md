---
"@langchain/core": patch
"@langchain/google-common": patch
---

fix(google): restore structured output parsing with includeRaw and reasoning blocks

Ensure structured output parsers read `BaseMessage` text content when `includeRaw: true`, so responses that include reasoning/thought blocks plus JSON text continue to parse correctly.
