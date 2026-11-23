---
"@langchain/core": patch
---

`BaseChatModel` streaming now ends its callback run with `handleLLMError` (a `ModelAbortError` carrying the partial output) when the consumer stops reading early with `break` or `return()`, instead of leaving it open.
