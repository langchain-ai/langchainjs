---
"@langchain/mcp-adapters": minor
---

Parallelize server initialization in MultiServerMCPClient. All MCP servers now connect concurrently via Promise.allSettled() instead of sequentially, significantly reducing startup time when multiple servers are configured.
