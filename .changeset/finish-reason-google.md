---
"@langchain/google": patch
---

Emit raw `finishReason`, `normalizedFinishReason` and `finishState` on `message-finish` for generate content and interactions. `SAFETY`, `PROHIBITED_CONTENT` and `BLOCKLIST` normalize to `refusal`; unmapped values to `other`.
