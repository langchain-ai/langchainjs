---
"@langchain/core": patch
---

fix(core): defer tool call chunk collapsing in AIMessageChunk to fix O(n²) streaming aggregation

`AIMessageChunk` eagerly re-ran `collapseToolCallChunks` in its constructor on every streamed delta `concat`, re-parsing all accumulated tool args each time — O(n²) over a stream, which can block the event loop for seconds on long tool-call streams. Collapsing now runs lazily, once, on first read of `tool_calls` / `invalid_tool_calls`.
