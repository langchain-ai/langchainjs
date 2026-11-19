---
"@langchain/google-common": patch
---

Emit raw `finishReason`, `normalizedFinishReason` and `finishState` on `message-finish`. `SAFETY`, `PROHIBITED_CONTENT` and `BLOCKLIST` normalize to `refusal`; unmapped values to `other`.
