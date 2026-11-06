---
"@langchain/core": patch
"@langchain/anthropic": patch
---

Translate Anthropic tool search blocks (`tool_search_tool_bm25`, `tool_search_tool_regex`, and `tool_search_tool_result`) to and from standard `server_tool_call` and `server_tool_call_result` content blocks instead of leaving them as `non_standard`.
