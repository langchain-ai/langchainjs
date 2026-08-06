---
"@langchain/anthropic": patch
"@langchain/core": patch
---

fix(anthropic): fix streaming with server tools producing invalid_tool_calls

- Track content block types by index during streaming so input_json_delta
  events for server_tool_use blocks do not emit tool_call_chunks (which
  lack id/name and fail validation in collapseToolCallChunks)
- Add web_fetch_tool_result, code_execution_tool_result, mcp_tool_result,
  mcp_tool_use, and other missing server tool result types to streaming
  and round-trip whitelists
- Fix double-JSON encoding of server_tool_use args when input is a string
