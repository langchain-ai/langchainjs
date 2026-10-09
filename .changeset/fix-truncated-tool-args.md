---
"@langchain/core": patch
---

fix(core): do not present repaired partial JSON as a finished tool call

When a stream is truncated mid-argument (`finish_reason: "length"`), partial
JSON like `{"path":"/etc/hosts","content":"line1` is repaired by
`parsePartialJson` into a valid-looking object and lands in `tool_calls`, so a
tool bound to that message could act on a truncated input with no signal that
it was cut off. `collapseToolCallChunks` now accepts a `truncated` flag;
`AIMessageChunk` passes it through based on `response_metadata.finish_reason`,
and truncated streams only keep strictly-complete arguments as finished tool
calls, routing repaired partial JSON to `invalid_tool_calls` instead.
