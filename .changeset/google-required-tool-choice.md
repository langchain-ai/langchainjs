---
"@langchain/google-common": patch
"@langchain/google-genai": patch
---

Fix `tool_choice: "required"` being sent to Gemini as a function name. The OpenAI-style value is now mapped to `"any"`, so the request no longer carries `allowedFunctionNames: ["required"]`.
