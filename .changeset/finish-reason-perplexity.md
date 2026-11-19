---
"@langchain/perplexity": patch
---

Set `finish_reason` and `normalized_finish_reason` in `response_metadata` on Chat Completions `invoke` and streamed results; unmapped values normalize to `other`.
