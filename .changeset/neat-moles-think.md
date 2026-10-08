---
"@langchain/deepseek": patch
---

Read tool calls only from AI chunks when splitting `<think>` tags

`ChatDeepSeek._streamResponseChunks` copied `tool_calls` and
`tool_call_chunks` from each streamed chunk's message, which is typed as a
`BaseMessageChunk`. The message is an `AIMessageChunk` for assistant deltas
but a `ChatMessageChunk` when the stream sends no role, so the fields are now
read once, after an `AIMessageChunk.isInstance` check.

No behaviour change.
