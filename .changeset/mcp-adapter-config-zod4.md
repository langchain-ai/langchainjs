---
"@langchain/mcp-adapters": major
---

For applications upgrading from adapter 1.x, use `new MCPAdapter({ servers })`
as the canonical client API. `MultiServerMCPClient` and existing server-map
configurations remain supported; the class alias is deprecated.

Upgrade to Zod 4. Configuration now rejects conflicting options and unknown output-handling keys. Hook argument overrides must be objects. Configuration snapshots preserve notification callbacks, tool hooks and OAuth provider identity. Connection-error handlers retain native Zod function validation.

Read configuration through `adapter.config.servers` for every constructor form;
the getter no longer exposes `mcpServers`. `ResolvedMCPAdapterConfig` describes
this snapshot. `SSEConnection` now accepts only legacy SSE; use
`StreamableHTTPConnection` for HTTP or `Connection` for any supported transport.
Remove unsupported stdio `encoding`; retry counts must be nonnegative integers
and delays must be nonnegative.

Hook `state` is now typed as `unknown` rather than an object record. Its runtime value is unchanged. Applications must narrow it before accessing properties.

Remove `useStandardContentBlocks`; tool content always uses standard LangChain blocks. Update image/audio consumers to use `data` and `mimeType`. Artifact-routed blocks keep their MCP format, including when passed through `afterToolCall`; resource reads remain explicit.

Resource types now derive from the MCP SDK. `readResource()` preserves SDK content metadata; narrow with `"text" in content` or `"blob" in content` before accessing those fields.

Prefer `listTools()`; `getTools()` remains a compatibility alias. Connections negotiate automatically by default. Add `mode: "legacy"` to enable legacy callbacks and connection options. Explicit `mode: "modern"` prevents legacy negotiation and SSE fallback. Unknown and incompatible configuration fields fail with Zod errors, including empty server maps.

Move notification and progress callbacks into each server configuration. `onInitialized` and explicit SSE fallback settings require legacy mode. Remove `onRootsListChanged`: roots notifications originate from clients, so this server observer did not implement roots support. Supply workspace paths through tool parameters, resource URIs, or server configuration instead. Global LangChain hooks, naming, output policies, and load-error handling remain adapter options.

Preserve the original server JSON Schema using the official MCP core schemas and
SDK validator. Remove automatic schema simplification; model-specific schema
overrides remain separate from post-hook argument validation. Public loader
options reject invalid values before discovery.

Require `@langchain/core ^1.2.6` for branded `ToolException` and `MCPClientError`.
Both errors are exported and preserve original causes. Tool failures retain MCP
error responses in `result`; SDK argument-validation issues become Zod4 errors.
Use `isToolException()` or the error classes' `isInstance()` methods to narrow
errors across module copies. Name-only lookalikes no longer match.

Tool-error messages retain the original error text without custom Zod formatting.
Structured issues, paths and stacks remain available in the original `cause`.
