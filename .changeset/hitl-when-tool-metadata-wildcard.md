---
"langchain": patch
---

Expose the agent's registered tools to middleware via `runtime.tools`, populate `request.tool` in the human-in-the-loop `when` predicate so it can gate on tool metadata, and add a `"*"` catch-all key to `interruptOn` for tools without an explicit entry. Backward-compatible.
