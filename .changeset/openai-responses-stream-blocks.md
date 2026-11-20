---
"@langchain/openai": patch
---

Keep reasoning ids and `encrypted_content`, built-in tool items, text item ids and annotations on messages streamed from the Responses API through the chat model event stream, so the next request replays them.
