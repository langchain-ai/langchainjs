---
"@langchain/openai": patch
---

fix(openai): keep tool calls on streaming deltas with an empty-string role

Some OpenAI-compatible servers send `role: ""` instead of `"assistant"` on
streaming deltas. `delta.role ?? defaultRole` treated the empty string as a
real role, so the delta was converted to a generic `ChatMessageChunk` and any
`tool_calls` on it were silently dropped. Coalesce with `||` and fall back to
the inferred assistant role when no usable role is present.
