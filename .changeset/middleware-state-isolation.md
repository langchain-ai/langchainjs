---
"langchain": patch
---

fix(agents): derive middleware hook state from invocation state

Prevents middleware state from leaking across threads by deriving middleware hook input state from the current invocation state instead of cross-node cached state.
