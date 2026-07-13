---
"@langchain/core": patch
"@langchain/anthropic": patch
"@langchain/aws": patch
"@langchain/openai": patch
---

fix(core): align server tool result content block `type` to `server_tool_result`

Rename the server tool result discriminator literal from
`server_tool_call_result` to `server_tool_result` to match the canonical value
documented in the LangChain reference and emitted by `langchain-core` (Python),
where the TS and Python `type` literals previously diverged only on this block.
The `Tools.ServerToolCallResult` interface is renamed to `Tools.ServerToolResult`
with a deprecated `ServerToolCallResult` type alias kept for backward
compatibility.
