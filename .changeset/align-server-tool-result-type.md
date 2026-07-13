---
"@langchain/core": patch
"@langchain/anthropic": patch
"@langchain/aws": patch
"@langchain/openai": patch
---

fix(core): align server tool result content block `type` to `server_tool_result`

Rename the server tool result content block `type` from `server_tool_call_result`
to `server_tool_result`, matching `langchain-core` (Python). Renames
`Tools.ServerToolCallResult` to `Tools.ServerToolResult`, keeping a deprecated
`ServerToolCallResult` alias for backward compatibility.
