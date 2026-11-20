---
"@langchain/ollama": patch
---

Set `finish_reason` (the `done_reason`) and `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results, and emit them on `message-finish`; unmapped values normalize to `other`.
