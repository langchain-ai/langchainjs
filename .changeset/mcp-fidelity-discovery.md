---
"@langchain/mcp-adapters": major
---

For applications upgrading from adapter 1.x, use `listToolsets()` to discover
executable LangChain tools grouped by server.
`initializeConnections()` remains a deprecated wrapper with the same result.
Discovery options reject invalid values and unknown fields before connecting.
MCP content tags derive from the official SDK core schemas.

Preserve structured output, resource provenance and protocol metadata in artifacts.
Preserve native ToolMessage/Command results and graph interrupts.

Isolate catalogs and connections by effective headers and OAuth provider identity.
Share concurrent connection attempts, register handlers before connecting, and
release failed connections. Closing attempts every owned connection even if one
fails. The SDK handles tool, resource and template pagination; discovery failures
propagate to the caller. Local interoperability tests cover SDK 1.30 stdio and
SDK 2 HTTP/SSE servers.

Honor SDK discovery TTL and cache hints on each `listTools()` call. Use
`listTools([], { cacheMode: "refresh" })` to refresh the catalog, or `"bypass"` to
fetch without updating it. Previously returned tools remain unchanged. Close and
recreate the adapter when switching the account behind an OAuth provider.

Connection errors identify the configured protocol mode without interpreting
every HTTP failure as a protocol mismatch.
