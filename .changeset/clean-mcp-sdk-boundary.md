---
"@langchain/mcp-adapters": major
---

Migrate to stable MCP TypeScript SDK 2.x client packages. Legacy MCP servers and
existing adapter configuration remain supported. Applications passing an SDK
client to `loadMcpTools`, or using `getClient`, must migrate from
`@modelcontextprotocol/sdk` to `@modelcontextprotocol/client` and its SDK 2 APIs.

Export the OAuthClientProvider type from the adapter and update the affected
examples and migration documentation. Server packages remain development-only
dependencies. This dependency migration does not itself enable modern stateless
elicitation.
