---
"@langchain/google-common": patch
---

Auto-set `toolConfig.includeServerSideToolInvocations` when a Gemini request mixes server-side built-in tools (e.g. `googleSearch`, `codeExecution`) with function declarations. The Gemini API requires this flag in that case and returns HTTP 400 without it.
