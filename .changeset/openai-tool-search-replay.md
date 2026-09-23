---
"@langchain/openai": patch
---

Keep tool search results working across Responses API turns: replay `tool_search_call`/`tool_search_output` items (without ids in ZDR mode) and round-trip the `namespace` on function calls to tools loaded by tool search.
