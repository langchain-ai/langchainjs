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
again before it is answered and remote effects must be idempotent.
`beforeToolCall` runs once per execution, including replays, and any header
identity it supplies is re-derived rather than reused from the pause. Answers
are validated against the server's requested schemas; a missing, unexpected or
malformed answer fails the call rather than re-asking, since the caller resuming
the graph is code and not the human who filled the form. Sampling and roots
requests are refused by name, state-only responses are refused instead of
polled, and calling such a tool outside a graph — or inside one with no
checkpointer — explains how to answer it instead of hanging. Interrupt payloads
carry the server's questions and never its opaque continuation state.
