---
"@langchain/mcp-adapters": major
---

Negotiate MCP automatically when `mode` is omitted. Mixed modern and legacy
servers work without specifying their protocol in advance. Explicit `legacy`
enables legacy callbacks and skips probing; explicit `modern` requires modern
MCP without fallback. HTTP 404/405 can fall back to SSE; authentication and
network failures remain errors.

For applications upgrading from adapter 1.x, scope elicitation callbacks to
explicitly legacy servers. Requests and answers use native SDK core schemas and
preserve Zod validation issues. Modern configurations reject callback elicitation.
Logging levels and resource subscription filters also derive from SDK core schemas.

Scope modern request logging and round limits to each modern server. Reject these options on legacy connections and at the adapter root. Keep tool catalogs current through SDK subscriptions even when no application observer is configured.

Add per-server resourceSubscriptions with modern listen and legacy subscribe routing. Reject unsupported resource subscriptions and modern reconnect configuration; modern response streams cannot be replayed. Document protocol logging, SSE, and OAuth DCR deprecations without tying authorization-server compatibility to MCP mode.
