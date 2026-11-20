---
"@langchain/openrouter": patch
---

Set `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results (`error` normalizes to `error`); unmapped values normalize to `other`.
