---
"@langchain/mcp-adapters": major
---

Rebuild the adapter on the stable MCP TypeScript SDK 2 client packages, negotiate
the protocol automatically, and answer modern MCP elicitation with LangGraph
interrupts.

### Upgrading from 1.x

- **Client API.** `new MCPAdapter({ servers })` is canonical; `MultiServerMCPClient`,
  `mcpServers` and `initializeConnections()` still work as deprecated aliases.
  `getTools()` becomes `listTools()`. Read configuration through
  `adapter.config.servers` — typed `ResolvedMCPAdapterConfig` — which no longer
  exposes `mcpServers`.
- **SDK packages.** Import from `@modelcontextprotocol/client`, not
  `@modelcontextprotocol/sdk`, if you pass an SDK client to `loadMcpTools` or call
  `getClient`. Server packages stay development-only.
- **Transports.** `SSEConnection` accepts only legacy SSE; use
  `StreamableHTTPConnection` for HTTP or `Connection` for any transport. Stdio
  `encoding` is unsupported, retry counts must be nonnegative integers and delays
  nonnegative.
- **Zod 4.** Configuration rejects conflicting options, unknown output-handling
  keys, incompatible fields and empty server maps with Zod errors; hook argument
  overrides must be objects. Tool schemas now preserve the server's original JSON
  Schema through the MCP core schemas and SDK validator, so automatic
  simplification is gone.
- **Content and callbacks.** `useStandardContentBlocks` is gone — tool content is
  always standard LangChain blocks, so image and audio consumers read `data` and
  `mimeType`, while artifact-routed blocks keep their MCP format, including through
  `afterToolCall`. Hook `state` is typed `unknown`; narrow before use.
  `readResource()` preserves SDK content metadata, so narrow it with
  `"text" in content` or `"blob" in content`. Notification and progress callbacks
  move into each server's configuration, where `onInitialized` and explicit SSE
  fallback require legacy mode. `onRootsListChanged` is removed: roots
  notifications come from clients, so that observer never implemented them.
- **Errors.** Branded `ToolException` and `MCPClientError` require
  `@langchain/core ^1.2.6`. Both preserve causes — tool failures keep the MCP error
  response in `result` — and must be narrowed with `isToolException()` or
  `isInstance()`, since name-only lookalikes no longer match across module copies.
- **Logging.** The internal `debug` dependency is gone, so
  `DEBUG=@langchain/mcp-adapters:*` emits nothing. Use `onConnectionError` and the
  per-server notification callbacks.

### Protocol negotiation

Connections negotiate their revision when `mode` is omitted, so mixed modern and
legacy servers need no declaration in advance. `mode: "modern"` forbids fallback;
`mode: "legacy"` skips probing and enables the legacy callbacks. SSE always speaks
legacy and rejects `mode: "modern"`. HTTP 404/405 may fall back to SSE
(`automaticSSEFallback`); authentication and network failures stay errors.
`setLoggingLevel()` remains legacy-only.

### Elicitation through interrupts

A modern server needing input answers `tools/call` with an `input_required`
result; the adapter raises each round as a LangGraph `interrupt()` and resumes
with `createMCPElicitationResume(interrupt, responses)`. Resuming replays the
call, so servers and hooks must be replay-safe — `beforeToolCall` runs once per
execution and the adapter promises no exactly-once effects. Answers are validated
against the requested schemas. Sampling and roots requests
are refused by name, and calling such a tool outside a graph explains how to
answer it instead of hanging. Legacy servers keep `onElicitation`, unchanged.

### Results, discovery and connections

Structured output, resource provenance and protocol metadata survive in artifacts;
`ToolMessage`, `Command` and graph interrupts are returned rather than flattened.
Every `callTool` forwards the discovered descriptor as `toolDefinition`, so
`Mcp-Param-*` mirroring and output-schema validation use the definition the
LangChain tool schema was built from. `listToolsets()` groups executable tools by
server. Catalogs and connections are isolated by effective headers and OAuth
provider identity, so recreate the adapter when switching the account behind a
provider. `listTools([], { cacheMode: "refresh" | "bypass" })` drives the SDK's
discovery cache, and a failed refresh restores the previous catalog rather than
discarding a working one.

### Server interactions

Per-server `resourceSubscriptions` and `logLevel`, each rejected where the
protocol cannot serve them. `onCancelled` composes with the
SDK's own dispatch instead of replacing it, so observing a cancellation no longer
stops the SDK acting on it.

### Fixes

A background reconnection that exhausts its attempts now reports through
`onConnectionError` instead of failing silently. An `Authorization` header
configured alongside an `authProvider` replaces the provider's token instead of
being joined with it into a value servers reject. An `onProgress` callback that
throws no longer fails a tool call that already completed.
