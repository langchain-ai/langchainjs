---
"langchain": patch
---

fix(agents): route `beforeModel → END` through `exitNode` so `afterAgent` hooks always run

When `modelCallLimitMiddleware` (or any middleware whose `beforeModel` hook returns
`{ jumpTo: "end" }`) terminates a run via `exitBehavior: "end"`, the graph should
pass through the `afterAgent` node chain before reaching `END`. Previously,
`#createBeforeModelRouter` routed directly to bare `END`, bypassing all `afterAgent`
hooks. This caused `runModelCallCount` to remain stuck at the limit value in the
LangGraph checkpoint, permanently blocking every subsequent user turn in that
thread — each new turn would hit `beforeModel` with `count >= limit` and immediately
terminate with no model call.

The fix mirrors the existing behaviour of `#createBeforeAgentRouter`: when the
jump target is `END`, route to `exitNode` (the first `afterAgent` node) instead of
bare `END`. This guarantees `afterAgent` — including the `runModelCallCount` reset
in `modelCallLimitMiddleware` — always runs at the end of every invocation,
regardless of how the run was terminated.
