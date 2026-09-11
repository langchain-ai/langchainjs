---
"@langchain/mcp-adapters": minor
---

Negotiate modern and legacy MCP connections per server and support validated form and URL elicitation callbacks with bounded input rounds.

HTTP and stdio connections now negotiate automatically; explicit SSE remains
legacy. Use `protocolVersion: "legacy"` or `{ pin: "2026-07-28" }` to constrain
negotiation. SDK package versions and protocol revisions are different values.

Subscribe to advertised modern catalog changes when list-change callbacks are
configured. Subscription setup failures reject the connection. Set `logLevel`
globally or per server for modern tool-call logs; `setLoggingLevel()` remains
legacy-only. Callback elicitation does not create a checkpointed graph pause.
