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

Forward the descriptor discovered for a tool to the SDK as `toolDefinition` on
every `callTool`. SEP-2243 `Mcp-Param-*` header mirroring and output-schema
validation now use the same definition the LangChain tool schema was built from,
instead of the SDK's separate `tools/list` cache, so the two views cannot disagree.

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

A failed refresh no longer discards a working catalog or closes a client whose
tools were already handed to a caller. The previous catalog entry is restored and
the connection stays usable. A discovery failure releases the connection only when
it is the last in-flight discovery for that client and none of them succeeded, so a
concurrent refresh failure cannot discard a catalog another call installed.

Connection errors identify the configured protocol mode without interpreting
every HTTP failure as a protocol mismatch.

Remove the internal `debug` logging dependency. The adapter no longer emits
`@langchain/mcp-adapters:client` or `@langchain/mcp-adapters:connection` traces
under the `DEBUG` environment variable. Use the `onConnectionError` handler and
the per-server notification callbacks for operational visibility.
