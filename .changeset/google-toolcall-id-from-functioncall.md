---
"@langchain/core": patch
---

fix(core): use Gemini functionCall id for tool_call content blocks

When normalizing a Google/Gemini `AIMessage` via `contentBlocks`, the
`functionCall` → `tool_call` translation always took its `id` from
`message.id`, dropping the per-call `functionCall.id` that newer Gemini
responses provide. The resulting `tool_call` block had a missing or wrong
`id` (`message.tool_calls[0].id` and `contentBlocks[0].id` disagreed),
breaking downstream code that correlates tool calls by id. The translator
now prefers `functionCall.id` and falls back to `message.id` only when the
call has no id of its own.
