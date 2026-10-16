---
"@langchain/core": patch
---

Treat missing streamed tool-call args as an empty object in finalizeContentBlock so zero-arg tools are not marked invalid_tool_call.
