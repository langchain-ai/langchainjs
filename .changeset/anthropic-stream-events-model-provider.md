---
"@langchain/anthropic": patch
---

Put `model_provider` on the `message-finish` event's `responseMetadata` so v3 `streamEvents` keeps thinking blocks when tool results are sent back.
