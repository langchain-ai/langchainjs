---
"langchain": patch
---

feat(agents): support returning Command from wrapModelCall middleware

Allow `wrapModelCall` middleware hooks to return `Command` objects for advanced
control flow (routing, state updates), matching the existing `wrapToolCall`
pattern. The framework tracks the effective AIMessage through the middleware
chain so outer middleware always receive an AIMessage from `handler()`, even
when an inner middleware returns a Command.
