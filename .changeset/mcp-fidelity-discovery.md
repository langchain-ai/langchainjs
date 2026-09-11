---
"@langchain/mcp-adapters": major
---

Preserve structured output, resource provenance and protocol metadata in artifacts. Preserve native ToolMessage/Command results and graph interrupts. Expose semantic tool error envelopes through ToolException and retain transport causes.

Validate effective post-hook arguments against the original server JSON Schema without mutating descriptors. Expose the original JSON Schema without flattening unions, inlining references, or dropping conditional constraints. Model-facing schema overrides remain separate from invocation validation.

Isolate catalogs and connections by effective headers and OAuth provider identity. Deduplicate acquisitions, install handlers before connection, clean up failed handshakes/discovery, and settle every owned close. Delegate tools/resources/templates pagination to the SDK and propagate discovery errors instead of returning empty catalogs. Test SDK 1.30 stdio alongside SDK 2 HTTP/SSE servers; protocol negotiation remains unchanged.

Honor SDK discovery TTL and cache hints on each `getTools()` call. Use
`getTools([], { cacheMode: "refresh" })` to refresh the catalog, or `"bypass"` to
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
