---
"@langchain/anthropic": patch
---

feat(anthropic): support mid-conversation tool changes. A `SystemMessage` can now carry Anthropic's `tool_addition` and `tool_removal` blocks, either bare in `content` or wrapped in a `non_standard` block, and they reach the provider verbatim. The required beta is added automatically: `mid-conversation-tool-changes-2026-07-01` for tools named by reference, or `inline-tools-2026-09-15` when a `tool_addition` defines a tool by value (`tool: { type: "tool_definition", definition }`).

System content is now narrowed to what Anthropic accepts there. `text`, `tool_addition` and `tool_removal` are sent; any other block is dropped with a warning instead of being forwarded for the provider to reject. A system message left with no content is omitted.
