---
"@langchain/mcp-adapters": patch
---

Demonstrate modern elicitation recovery with a runnable `createAgent` example
covering both form and URL questions. The example answers each question with
`createMCPElicitationResume`, rebuilds the MCP adapter between rounds, and keeps
the checkpointed run, so it shows that losing the client does not lose the
pending question.

Document what a resume actually does: it replays the tool call, so work the
server performed before asking happens again and `beforeToolCall` runs once per
execution. Recovery means the paused run survives a reconstructed adapter — not
that completed requests are reused.

Sign the example server's retry state and bind it to the MCP method, because
replayed request state crosses the wire on every round and cannot be trusted as
received. The demo key is ephemeral and single-process; the guidance states that
a production application needs a stable shared key bound to its authenticated
principal.

Cover reconstructed adapters and mixed legacy/modern stdio servers, and run the
example end to end for accept, decline and cancel.
