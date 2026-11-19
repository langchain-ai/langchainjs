---
"@langchain/mistralai": patch
---

Set `finish_reason` and `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results (`model_length` normalizes to `length`, `error` to `error`); unmapped values normalize to `other`.
