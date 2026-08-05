---
"@langchain/core": minor
---

feat(core): add `wrapRunExecution` callback-handler hook for run-scoped context propagation

Adds an optional `wrapRunExecution(runId, fn)` method to the callback handler
contract and a `BaseRunManager.withRunContext` / `withRunContextAsyncIterable`
composer that invokes it around the *execution* of a run body (chat model
`_generate`, streaming chunks, and tool `_call`).

Unlike the existing point-in-time `handle*Start`/`handle*End` callbacks, this
lets a handler keep an ambient context active for the whole duration of the
run. The motivating use case is distributed tracing: an OpenTelemetry handler
can make the run's span the active span so lower-level client instrumentations
(HTTP/`fetch`, DB drivers) emit spans nested under it instead of as
disconnected root traces. Handlers that do not implement the hook are
unaffected and incur no overhead.
