---
"@langchain/core": patch
---

fix(core): keep streamed text and tool calls in separate content blocks

When a legacy stream chunk carried both string `content` and a tool call,
`convertChunksToEvents` placed the text at content block index `0` and used
the provider's `tool_call_chunk.index` (also `0`) directly as the content
block index. The two collided: the tool call fields were merged onto the
existing text block, which stayed `type: "text"`, so the finalized
`AIMessage` had `tool_calls: []` and agents would stop instead of running
the tool. Provider tool-call indexes are scoped to the tool-call list, not
to the global content-block list, so each distinct tool call is now mapped
onto its own freshly allocated content block index.
