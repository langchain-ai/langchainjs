---
"langchain": patch
---

fix(langchain): keep structured output tool names stable for prompt caching

An untitled `responseFormat` schema produced a tool named from a module-global
counter, so the structured output tool was called `extract-1` on one model
request and `extract-2` on the next. Providers render tool definitions at the
front of the cached prompt prefix, so the changing name invalidated the prompt
cache on every request in an agent loop - the system prompt and message history
included.

Generated names are now assigned by position in the `responseFormat` list, so a
given schema keeps the same name across every request in a loop, across turns of
a conversation, and across separate processes. Schemas carrying a title are
unaffected and do not consume a position.
