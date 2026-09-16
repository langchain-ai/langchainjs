---
"@langchain/mcp-adapters": minor
---

Pause modern tool calls with LangGraph interrupts for form or URL input, using
the same replay contract as the Python adapter.

Resuming replays the tool call. The adapter keeps no durable record of a round:
the tool node re-runs from the top, the initial `tools/call` is issued again, and
`interrupt()` returns the supplied answer instead of pausing. Only then is the
answered follow-up sent, carrying the `requestState` returned by the response
that execution just replayed. Rounds already answered are replayed as well.

Work a server performed before asking therefore runs again on resume, and
`beforeToolCall` runs again once per execution. Servers and hooks must be
replay-safe; the adapter promises no exactly-once effects.

Answer a question with `createMCPElicitationResume(interrupt, responses)`, which
builds `{ [interruptId]: { responses } }` so an answer reaches the interrupt it
was written for rather than an unrelated one paused in the same run. Answers are
validated against the pending request keys and their requested schemas, and an
invalid answer re-interrupts with a validation error on the same thread so it can
be corrected.

Targeting an interrupt does not make replayed server work idempotent, and it does
not isolate arbitrary `Promise.all` calls inside one user node. Parallel MCP tool
calls issued by `createAgent` are answered independently.

`beforeToolCall` may return dynamic headers for a graph call. They are applied
through the client's own fork for that execution only, and no credential is
persisted between executions. Legacy elicitation keeps its callbacks.

A response that requests input while carrying no input requests is rejected
rather than polled.
