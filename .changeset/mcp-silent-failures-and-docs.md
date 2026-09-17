---
"@langchain/mcp-adapters": patch
---

Report a background reconnection that exhausted its attempts through
`onConnectionError`. Previously every attempt and the final exhaustion were
swallowed by a bare catch, so a server that never came back produced no signal
at all.

Correct the `onProgress` contract, which said callback failures were reported
through a debug logger the package no longer has: they are ignored so an
observer cannot fail a tool call that already completed.
`maxElicitationRounds` and `logLevel` now say they require
`mode: auto or modern` rather than `modern`, which is what the schema accepts.

Document elicitation and the error surface in the package README: answering an
`input_required` result with `createMCPElicitationResume`, the checkpointer
requirement, the replay contract, and how `ToolException`, `MCPClientError`,
`isToolException()` and `onConnectionError` relate. Correct the negotiation
description, which did not say that SSE always speaks legacy and rejects
`mode: "modern"`.
