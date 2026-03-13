---
"@langchain/openai": minor
"@langchain/core": patch
---

feat(openai): support tool search and defer_loading

- Add `tools.toolSearch()` factory for the OpenAI Responses API `tool_search` built-in tool, supporting both server-executed and client-executed modes.
- Propagate `defer_loading` from LangChain tool `extras` through `bindTools()` and into the Responses API payload, enabling on-demand tool discovery.
- Handle `tool_search_call` and `tool_search_output` response items in both streaming and non-streaming converters.
- Add core block translator support to convert `tool_search_call` → `server_tool_call` and `tool_search_output` → `server_tool_call_result`.
