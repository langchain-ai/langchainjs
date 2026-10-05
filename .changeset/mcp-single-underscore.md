---
"@langchain/mcp-adapters": patch
---

Use a single underscore between MCP server names and tool names (`server_tool` instead of `server__tool`). The separator for `additionalToolNamePrefix` remains unchanged (`mcp__server_tool`).
