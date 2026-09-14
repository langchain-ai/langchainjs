---
"@langchain/mcp-adapters": major
---

For applications upgrading from adapter 1.x, use `listToolsets()` to discover
executable LangChain tools grouped by server.
`initializeConnections()` remains a deprecated wrapper with the same result.
Public loader and discovery options reject invalid values and unknown fields
before connecting. Tool JSON objects and MCP content tags derive from the
official SDK core schemas.

Preserve structured output, resource provenance and protocol metadata in artifacts. Preserve native ToolMessage/Command results and graph interrupts. Expose semantic tool error envelopes through ToolException and retain transport causes.

Validate effective post-hook arguments against the original server JSON Schema without mutating descriptors. Expose the original JSON Schema without flattening unions, inlining references, or dropping conditional constraints. Model-facing schema overrides remain separate from invocation validation.

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

Remove the adapter's automatic provider schema simplification. Servers must expose
schemas supported by the chosen model provider, or applications must explicitly
set a provider-compatible `tool.schema` before binding tools. For example, the
Anthropic integration omits tools with root-level `allOf`, `anyOf`, or `oneOf`.
Invalid initial arguments can now fail core's input validation before hooks run.

Require `@langchain/core >=1.2.6 <2` for branded `ToolException` errors. Use
`ToolException.isInstance(error)` or the retained `isToolException(error)` helper;
objects that merely have `name: "ToolException"` no longer match. Original causes
and MCP error envelopes remain available.

Preserve Zod validation errors as tool failure causes, including structured issues; convert SDK argument-validation issues to Zod4 errors rather than discarding them in a message.

Export branded `MCPClientError` and preserve the original cause of connection and discovery failures. Connection errors identify the configured protocol mode without interpreting every HTTP failure as a protocol mismatch. Shared error parsing now retains HTTP status precedence and structured Zod diagnostics.
