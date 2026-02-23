---
"@langchain/anthropic": patch
---

fix(anthropic): convert tool_calls to tool_use blocks when AIMessage content is an empty array

When `AIMessage.content` was an empty array `[]` with `tool_calls` present, the tool calls were silently dropped during message formatting. This caused Anthropic API requests to fail with a 400 error. The array content branch now appends any tool_calls not already represented in the content array as `tool_use` blocks, matching the behavior of the string content path.
