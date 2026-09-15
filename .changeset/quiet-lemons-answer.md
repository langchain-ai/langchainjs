---
"@langchain/mcp-adapters": major
---

Default HTTP and stdio connections to modern MCP. Select `mode: "legacy"` explicitly for legacy servers, including SSE. SDK package versions and protocol revisions are separate values.

Configure validated form and URL elicitation callbacks on individual legacy servers. Configure `logLevel` and `maxElicitationRounds` on modern servers. Modern catalog subscriptions keep tool caches current even without an application observer; subscription failures reject the connection. `setLoggingLevel()` remains legacy-only.
