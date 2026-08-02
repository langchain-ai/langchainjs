---
"@langchain/google-common": patch
---

Send `toolConfig.functionCallingConfig.mode` using the uppercase Gemini enum values (`AUTO` / `ANY` / `NONE`). The lowercase values sent previously were ignored by the API, which made `tool_choice` (including forcing a specific function) a silent no-op.
