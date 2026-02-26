---
"@langchain/google-common": patch
---

fix(google-common): preserve anthropic tool_use blocks and avoid duplicates in Claude Vertex formatting

Improve Anthropic message conversion in the Vertex Claude path by preserving `tool_use` blocks from assistant content and deduplicating `tool_use` entries when they also appear in `tool_calls`.

Add regression tests for Anthropic formatting with multi-turn/tool message flows.
