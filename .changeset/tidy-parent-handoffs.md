---
"langchain": patch
---

Preserve parent graph state updates when ToolNode combines handoff commands containing Send objects, including multiple writes to the same reducer-backed channel.
