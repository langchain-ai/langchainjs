---
"@langchain/google": patch
---

Set `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results for generate content and interactions, and emit it on `message-finish`. `SAFETY`, `PROHIBITED_CONTENT` and `BLOCKLIST` normalize to `refusal`, `MALFORMED_FUNCTION_CALL` and `MALFORMED_RESPONSE` to `error`, and unmapped values to `other`.
