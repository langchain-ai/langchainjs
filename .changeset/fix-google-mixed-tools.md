---
"@langchain/google": patch
---

fix(google): set `toolConfig.includeServerSideToolInvocations` when mixing built-in and function-declaration tools, which Gemini otherwise rejects with a 400
