---
"@langchain/mcp-adapters": minor
---

Add `clientCapabilities` to server config and preserve a tool definition's `_meta`.

Together these let an adapter-based client take part in MCP extensions that negotiate on
`initialize` and then carry their payload on the tool definition — MCP Apps (SEP-1865) being the
motivating case. `clientCapabilities` is forwarded to the MCP SDK `Client` constructor so the
server sees what the client supports, and `tool._meta` from `tools/list` is now kept on the
resulting tool's `metadata`, alongside `annotations`.

Clients that do not set `clientCapabilities` construct exactly as before.
