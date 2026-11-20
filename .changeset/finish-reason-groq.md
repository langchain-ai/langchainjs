---
"@langchain/groq": patch
---

Set `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results; unmapped values normalize to `other`.
