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

Opt a modern server in with `elicitation: true`. It then answers `tools/call`
with an `input_required` result, the adapter raises each round as a LangGraph
`interrupt()`, and you resume with
`createMCPElicitationResume(interrupt, responses)`. A server that does not opt
in behaves exactly as before, and legacy servers keep `onElicitation`,
unchanged.

Resuming replays the tool call from its first round, so the server is asked
again before it is answered: N questions cost O(N^2) requests, and servers and
hooks must be replay-safe. `beforeToolCall` runs once per execution, replays
included, and the adapter promises no exactly-once effects. Because the server
issues a fresh continuation on every resume, a pause cannot outlive a
`requestState` lifetime.

Each interrupt carries a `questionId` derived from the question's content and
the call's effective arguments, and the resume is bound to it. If the replayed
round asks something different under the same keys and schema — "approve
$1,000" where the human approved "approve $10" — or `beforeToolCall` resolves
different arguments, the saved answer is refused rather than applied to an
operation nobody agreed to; the refused run is rolled back, leaving the
original question pending. A resume is parsed as a whole against the question
it answers — matching `questionId`, exactly the server's keys, and each answer
against that question's requested schema — so a missing, unexpected or
malformed answer fails the call rather than re-asking, since the caller
resuming the graph is code and not the human who filled the form.

Rounds go through the SDK's own manual input-required path (the per-call
`allowInputRequired` request option), so `Mcp-Param-*` mirroring and descriptor
forwarding are unchanged; the output schema is withheld from the rounds, whose
`input_required` results carry no structured content, and the terminal result
is validated against it instead. The elicitation capability is advertised per
request rather than at initialization, so an `auto` connection that negotiates
legacy never advertises it. Sampling and roots requests are refused by name,
state-only responses are refused instead of polled, and calling such a tool
outside a graph — or inside one with no checkpointer — explains how to answer
it instead of hanging.

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

Per-server `resourceSubscriptions`, `logLevel` and `elicitation`, each rejected
where the protocol cannot serve them. `onCancelled` is removed: the SDK exposes
no seam that observes `notifications/cancelled` without displacing its own
dispatch, and replacing that handler stopped the SDK aborting the request it
was told about.

### Fixes

A background reconnection that exhausts its attempts now reports through
`onConnectionError` instead of failing silently. An `Authorization` header
configured alongside an `authProvider` replaces the provider's token instead of
being joined with it into a value servers reject. An `onProgress` callback that
throws no longer fails a tool call that already completed.
