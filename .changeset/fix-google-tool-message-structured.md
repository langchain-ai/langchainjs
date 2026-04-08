---
"@langchain/google-common": patch
---

Pass structured JSON objects directly in `FunctionResponse.response` instead of wrapping them in `{ content: ... }`, matching the Gemini API's expected format.
