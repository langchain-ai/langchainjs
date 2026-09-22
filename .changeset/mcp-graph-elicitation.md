---
"@langchain/mcp-adapters": minor
---

Answer modern MCP elicitation with LangGraph interrupts, opt in per server with
`elicitation: true`. A modern server that needs input answers `tools/call` with
an `input_required` result; the adapter raises each round as an `interrupt()`
and resumes with `createMCPElicitationResume(interrupt, responses)`. Legacy
elicitation callbacks remain unchanged, and a connection that does not opt in
behaves exactly as before.

Rounds are driven through the SDK's own manual input-required path — the
per-call `allowInputRequired` request option — rather than a client subclass, so
`Mcp-Param-*` header mirroring and descriptor forwarding are unchanged. The
elicitation capability is advertised per request instead of at initialization,
so an `auto` connection that negotiates legacy never advertises it.

Resuming replays the tool call from its first round, so the server is asked
again before it is answered and remote effects must be idempotent. Because the
server therefore issues a fresh continuation on every resume, a pause cannot
outlive a `requestState` lifetime.

The answer travels with the question it answers: `createMCPElicitationResume`
copies the pending question into the resume, and the adapter accepts the answer
only if that question still matches the one now being asked. If the replayed
round asks something different under the same keys and schema — "approve
$1,000" where the human approved "approve $10" — or `beforeToolCall` resolves
different arguments, the saved answer is refused rather than applied to an
operation nobody agreed to. The refused run is rolled back, leaving the
original question pending. Questions are compared structurally, so a server
that reorders a schema's keys between rounds is still answerable.
`beforeToolCall` runs once per execution, including replays, and any header
identity it supplies is re-derived rather than reused from the pause. A resume
is parsed as a whole against the question it answers — exact keys, the server's
requested schemas, and that question itself — so a missing, unexpected or
malformed answer fails the call rather than re-asking, since the caller
resuming the graph is code and not the human who filled the form. Sampling and roots
requests are refused by name, state-only responses are refused instead of
polled, and calling such a tool outside a graph — or inside one with no
checkpointer — explains how to answer it instead of hanging. Interrupt payloads
carry the server's questions and never its opaque continuation state.
