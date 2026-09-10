---
"langchain": patch
---

fix(langchain): derive structured output tool names from the schema

An untitled `responseFormat` schema produced a tool named from a module-global
counter, so the structured output tool was called `extract-1` on one model
request and `extract-2` on the next. Providers render tool definitions at the
front of the cached prompt prefix, so the changing name invalidated the prompt
cache on every request in an agent loop — the system prompt and message history
included.

The generated name is now a hash of the emitted JSON Schema, so the same schema
yields the same tool name across every request in a loop, across turns of a
conversation, and across separate processes. Schemas carrying a title are
unaffected. Two identical schemas in one `responseFormat` list now collapse to a
single tool rather than two indistinguishable ones.
