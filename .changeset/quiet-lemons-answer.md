---
"@langchain/mcp-adapters": major
---

HTTP and stdio connections negotiate their protocol revision when `mode` is omitted. Select `mode: "modern"` to require modern MCP with no legacy fallback, or `mode: "legacy"` to skip probing and enable the legacy callbacks. SSE always speaks legacy whatever the mode, and rejects `mode: "modern"`; set `mode: "legacy"` on an SSE server only to use `onElicitation`, `onInitialized` or `automaticSSEFallback`. SDK package versions and protocol revisions are separate values.

Configure validated form and URL elicitation callbacks on individual legacy servers. Configure `logLevel` on servers that may negotiate modern, which is any server not pinned to `mode: "legacy"`. Modern catalog subscriptions keep tool caches current even without an application observer; subscription failures reject the connection. `setLoggingLevel()` remains legacy-only.
