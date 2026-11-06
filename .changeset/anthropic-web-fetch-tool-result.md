---
"@langchain/anthropic": patch
---

Handle `web_fetch_tool_result` server-tool result blocks in streaming and message serialization. The block was previously dropped while streaming and stripped on input, causing Anthropic to return HTTP 400 ("web_fetch tool use ... without a corresponding web_fetch_tool_result block") on the following turn.
