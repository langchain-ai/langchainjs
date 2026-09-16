---
"@langchain/mcp-adapters": major
---

HTTP and stdio connections negotiate their protocol revision when `mode` is omitted. Select `mode: "legacy"` explicitly for legacy servers, including SSE, or `mode: "modern"` to require modern MCP with no legacy fallback. SDK package versions and protocol revisions are separate values.

Configure validated form and URL elicitation callbacks on individual legacy servers. Configure `logLevel` and `maxElicitationRounds` on modern servers. Modern catalog subscriptions keep tool caches current even without an application observer; subscription failures reject the connection. `setLoggingLevel()` remains legacy-only.
