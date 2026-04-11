---
"@langchain/google": patch
---

Strip `type` field from `executableCode` and `codeExecutionResult` content blocks when converting back to Gemini API format, preventing 400 errors in multi-turn conversations.
