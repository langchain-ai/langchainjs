---
"@langchain/core": patch
---

Fix ChatVertexAI/ChatGoogle content blocks: include `tool_call` blocks from `message.tool_calls` and skip spurious empty `text` blocks in `contentBlocks`.
