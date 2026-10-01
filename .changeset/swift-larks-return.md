---
"@langchain/cohere": patch
---

Return Cohere tool calls as valid `tool_calls` from `.stream()` and streaming `invoke()`

`.stream()`, and `invoke()` with `streaming: true`, put each tool call's
parameters object into its tool call chunk's `args`, which must be a JSON
string, so every call landed in `invalid_tool_calls` with
`args: "[object Object]"` and `tool_calls` came back empty. With
`streamUsage: false` the tool calls were dropped altogether. They now come
back as valid `tool_calls` with the tool's name and parameters, whatever
`streamUsage` is set to. `streamUsage` now only controls whether the last
(`stream-end`) chunk carries `usage_metadata`.
