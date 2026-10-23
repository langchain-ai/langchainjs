---
"@langchain/openai": patch
---

Set `response_metadata.model_name` on messages streamed from the Responses API through the chat model event stream, matching the Chat Completions stream and the non-streaming Responses path.
