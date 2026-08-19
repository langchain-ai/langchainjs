---
"@langchain/anthropic": patch
---

Round-trip the tool search server-tool result blocks (`tool_search_tool_bm25_tool_result` / `tool_search_tool_regex_tool_result`) through message translation, mirroring `web_search_tool_result`. Without this, a multi-turn conversation using the tool search tool fails on the next request with `400 invalid_request_error … tool use … found without a corresponding … tool_result block`, because the result block was dropped from the assistant message (streaming capture) and on re-send (`toolTypes` passthrough).
