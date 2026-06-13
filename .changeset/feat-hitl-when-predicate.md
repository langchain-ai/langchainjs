---
"langchain": patch
---

feat(langchain): add `when` predicate to human-in-the-loop middleware

Add an optional `when` callback on `InterruptOnConfig` so callers can
dynamically skip interrupts for specific tool calls. The predicate receives
a `ToolCallRequest` (batch `afterModel` context) and returns whether to
interrupt or auto-approve, matching Python `HumanInTheLoopMiddleware`.
