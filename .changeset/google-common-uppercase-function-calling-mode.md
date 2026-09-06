---
"@langchain/google-common": patch
---

Serialize `toolConfig.functionCallingConfig.mode` in the Gemini enum's uppercase form. The Gemini API's `FunctionCallingConfig.Mode` is case-sensitive (`AUTO`, `ANY`, `NONE`), so the lowercase values sent previously matched no member and were silently ignored — leaving requests in the default AUTO mode. `tool_choice` of `"any"`, `"none"` or a forced function name was therefore a no-op on ChatVertexAI, and forced calls lost ANY-mode schema anchoring. `tool_choice` is still accepted lowercase; only the wire value changes. This matches the newer `@langchain/google` package, which already emits uppercase.
