---
"@langchain/core": patch
---

fix(core): deliver callbacks once to a handler registered twice by merged configs

Merging two runnable configs that both carry the same callback handler, as happens when an agent's `streamEvents()` runs inside a LangGraph node with tracing on, registered that handler twice, so it received every callback twice: every streamed chunk arrived twice. The configured callback manager now keeps each handler instance once, in order.
