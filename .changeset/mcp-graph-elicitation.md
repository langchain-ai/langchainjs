---
"@langchain/mcp-adapters": minor
---

Answer modern MCP elicitation with LangGraph interrupts, matching the Python
adapter's replay contract. A server needing form or URL input answers
`tools/call` with an `input_required` result; the adapter raises each round as an
`interrupt()` and resumes with `createMCPElicitationResume(interrupt, responses)`,
which targets the answer at the interrupt it was written for rather than an
unrelated one paused in the same run.

The SDK drives these rounds itself for a callback-shaped consumer, and that path
is unchanged. It cannot answer from a graph: the driver fulfils every pending
request concurrently while LangGraph matches resume values to `interrupt()` calls
by order, and `interrupt()` suspends by throwing. Rounds are therefore driven
from the frame that issued the call, intercepted at the SDK's own
`_resolveNonCompleteResult` seam so `Mcp-Param-*` header mirroring and
output-schema validation still wrap every response.

Resuming replays the tool call: the initial `tools/call` is issued again, the
server repeats its question, and `interrupt()` returns the supplied answer
instead of pausing. Work performed before a server asks therefore runs again,
`beforeToolCall` runs once per execution, and the adapter promises no
exactly-once effects — servers and hooks must be replay-safe. Answers are
validated against the requested schemas, and an invalid one re-asks on the same
thread without another round trip. One budget spans server rounds and re-asks
together, and a spent budget fails before pausing rather than after, so a run
is never suspended for an answer it can no longer use.

Only elicitation on a `tools/call` is answered through an interrupt. A response
embedding a sampling or roots request is refused by method name rather than
half-served, matching the Python adapter, and a modern server that asks for
input on another method is told which method the adapter cannot answer instead
of failing with an opaque capability error. An `input_required` response carrying no input
requests is rejected as unsupported rather than polled, an aborted call reports the abort rather than the
response it received, and calling such a tool outside a graph reports how to
answer it instead of hanging.
