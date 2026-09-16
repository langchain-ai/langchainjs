---
"@langchain/mcp-adapters": minor
---

Surface incomplete modern tool responses at the tool invocation boundary. An
`input_required` response is rejected with the pending response attached as the
error cause rather than continued by the adapter: answering a question requires a
LangGraph interrupt, which is why the interception boundary exists.

Reject state-only continuations — an `input_required` response carrying no input
requests — as unsupported. The adapter does not poll a server for completion, and
it makes no guarantee about reusing request state across calls. An aborted call
reports the abort rather than the response it happened to receive.

Retain effective arguments and per-call headers for each invocation without
sharing them between concurrent calls, and preserve cancellation and SDK output
validation. Handle background reconnection failures and use the SDK's stdio
environment defaults.
