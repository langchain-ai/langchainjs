---
"@langchain/mcp-adapters": major
---

Scope elicitation callbacks to explicitly legacy servers. Parse answers through SDK-owned schemas and preserve Zod validation issues. Modern configurations reject callback elicitation; checkpointed interruption support is delivered separately.

Scope modern request logging and round limits to each modern server. Reject these options on legacy connections and at the adapter root. Keep tool catalogs current through SDK subscriptions even when no application observer is configured.

Add per-server resourceSubscriptions with modern listen and legacy subscribe routing. Reject unsupported resource subscriptions and modern reconnect configuration; modern response streams cannot be replayed. Document protocol logging, SSE, and OAuth DCR deprecations without tying authorization-server compatibility to MCP mode.
