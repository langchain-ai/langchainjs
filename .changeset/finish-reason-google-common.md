---
"@langchain/google-common": patch
---

Set `finish_reason` and `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results, and emit them on `message-finish`. `SAFETY`, `PROHIBITED_CONTENT` and `BLOCKLIST` normalize to `refusal`, `MALFORMED_FUNCTION_CALL` and `MALFORMED_RESPONSE` to `error`, and unmapped values to `other`.
