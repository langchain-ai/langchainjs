---
"@langchain/mcp-adapters": major
---

Rebuild the adapter on the stable MCP TypeScript SDK 2 client packages, negotiate
the protocol automatically, and answer modern MCP elicitation with LangGraph
interrupts.

### Upgrading from 1.x

- **Elicitation pauses runs by default.** A modern server that asks for input
  during a tool call now raises a LangGraph `interrupt()`, so the run stops until
  it's resumed with `createMCPElicitationResume`. Set `elicitation: false` on a
  server to keep the 1.x behavior (see "Elicitation through interrupts" below).
- **Standard content blocks are always on.** 1.x defaulted
  `useStandardContentBlocks` to `false`; 2.0 removes the option and always returns
  standard blocks (details under "Content and callbacks").
- **Tool errors come back as messages.** Called with a tool call, as `createAgent`
  and LangGraph's `ToolNode` do, an MCP result with `isError` returns a
  `ToolMessage` with `status: "error"` and the server's content instead of
  throwing `ToolException`, so `toolRetryMiddleware` and `handleToolErrors` no
  longer see server-reported errors. The server's error text always reaches the
  model, and an error without text gets a one-line placeholder. Called with plain
  arguments, the tool still throws `ToolException` with the MCP result on `result`.
- **Several servers prefix tool names by default.** With more than one server,
  tools are named `{server}__{tool}` unless `prefixToolNameWithServerName` is
  set; 1.x defaulted it to `false`. A single server keeps its raw names. Set
  `prefixToolNameWithServerName: false` to keep 1.x names.
- **Duplicate tool names throw.** `listTools()` throws an `MCPClientError` when a
  tool name appears more than once in the flattened list, which now needs
  `prefixToolNameWithServerName: false` across servers or one server listing a
  name twice; pick tools from `listToolsets()` for the latter.
- **The model no longer sees `structuredContent` or `_meta` beside a single text
  block.** 1.x serialized them into the content; 2.0 sends only the text and keeps
  them in the artifact (details under "Content and callbacks").
- **Client API.** `new MCPAdapter({ servers })` is canonical; `MultiServerMCPClient`,
  `mcpServers` (or a flat server map), `initializeConnections()` and the
  `ClientConfig` type (now `MCPAdapterConfig`) still work as deprecated aliases.
  `getTools()` becomes `listTools()` and stays as a deprecated alias. Read configuration through
  `adapter.config.servers` — typed `ResolvedMCPAdapterConfig` — which no longer
  exposes `mcpServers`.
- **SDK packages.** Import from `@modelcontextprotocol/client`, not
  `@modelcontextprotocol/sdk`, if you pass an SDK client to `loadMcpTools` or call
  `getClient`. Server packages stay development-only. The `@langchain/langgraph`
  peer rises to `^1.4.13`.
- **Transports.** `SSEConnection` accepts only legacy SSE; use
  `StreamableHTTPConnection` for HTTP or `Connection` for any transport. Stdio
  `encoding` is unsupported, retry counts must be nonnegative integers and delays
  nonnegative. HTTP and SSE `reconnect` require `mode: "legacy"`, and only legacy
  mode resumes a dropped HTTP stream: `auto` and `modern` connections don't,
  where 1.x did by default.
- **Authentication.** `@modelcontextprotocol/client` 2.2 or later is required.
  Once an `authProvider` has a token it replaces a configured `Authorization`
  header (1.x sent the configured header instead); until then the header is
  sent, so a static API key can fall back to OAuth.
- **Zod 4.** Configuration rejects unknown server and top-level keys (1.x
  dropped them), conflicting options, unknown output-handling keys, incompatible
  fields and empty server maps with Zod errors; hook argument
  overrides must be objects. Tool schemas now preserve the server's original JSON
  Schema through the MCP core schemas and SDK validator, so automatic
  simplification is gone.
- **Content and callbacks.** `useStandardContentBlocks` is gone — tool content is
  always standard LangChain blocks, so image and audio consumers read `data` and
  `mimeType`, while artifact-routed blocks keep their MCP format, including through
  `afterToolCall`. A `resource_link` becomes a standard `file` block whose `url`
  is the link's URI and whose `mimeType` replaces 1.x's `mime_type`, with `uri`,
  `name` and `title` in `metadata`; the original block stays in the artifact as
  `mcp_content`. A single text block is now plain string content even when the
  result carries `structuredContent` or `_meta`, which 1.x serialized into the
  content with the text; read them from the `mcp_structured_content` and
  `mcp_meta` artifacts. Embedded resource URIs are no longer fetched while a
  result is converted; call `readResource()` for their contents. Hook `state` is typed `unknown`; narrow before use.
  `readResource()` preserves SDK content metadata, so narrow it with
  `"text" in content` or `"blob" in content`. Notification and progress callbacks
  move into each server's configuration, where `onInitialized` and explicit SSE
  fallback require legacy mode. `onRootsListChanged` is removed: roots
  notifications come from clients, so that observer never implemented them.
- **Errors.** Branded `ToolException` and `MCPClientError` require
  `@langchain/core ^1.2.6`. Both preserve causes — a thrown tool failure keeps the
  MCP error response in `result` — and must be narrowed with `isToolException()` or
  `isInstance()`, since name-only lookalikes no longer match across module copies.
- **Logging.** The internal `debug` dependency is gone, so
  `DEBUG=@langchain/mcp-adapters:*` emits nothing. Use `onConnectionError` and the
  per-server notification callbacks.

### Protocol negotiation

Connections negotiate their revision when `mode` is omitted, so mixed modern and
legacy servers need no declaration in advance. A server that ignores the probe
instead of rejecting it falls back only after the request timeout, and an HTTP
probe that times out or answers 403/5xx fails the connection; declare
`mode: "legacy"` for those. `mode: "modern"` forbids fallback;
`mode: "legacy"` skips probing and enables the legacy callbacks. SSE always speaks
legacy and rejects `mode: "modern"`, and with it `elicitation` and `logLevel`,
which only a modern server can serve; an `auto` HTTP connection that falls back
to SSE drops them instead. In `auto` mode only HTTP 404/405 may fall back to
SSE, while `mode: "legacy"` keeps 1.x's `automaticSSEFallback` on any 4xx;
authentication and network failures stay errors.
`setLoggingLevel()` remains legacy-only.

### Authentication

`authProvider` accepts the SDK's `AuthProvider` (`{ token, onUnauthorized? }`)
as well as an `OAuthClientProvider`. To finish an OAuth redirect, call the
SDK's `transport.finishAuth(params)` with the same provider (see the README);
the adapter reads the saved tokens through the provider. A connection that fails
on provider auth throws an `MCPClientError` whose `cause` is the SDK's
`UnauthorizedError` (now exported) when a login is needed or an `AuthProvider`
has no `onUnauthorized`, or an HTTP 401 error when credentials are still
rejected after `onUnauthorized` or a refresh; a tool call that hits the same
rejection fails with a `ToolException` instead. Servers that failed on
authentication are retried on the next discovery.

### Elicitation through interrupts

Modern in-band elicitation is enabled by default. When a modern `tools/call`
returns an `input_required` result, the adapter raises each round as a LangGraph
`interrupt()` whose value is an `MCPElicitationInterrupt`
(`type: "mcp_elicitation"`, `server`, `tool`, `arguments` and a `requests`
record keyed by the server's request keys), and you resume with
`createMCPElicitationResume(interrupt, responses)`. Set `elicitation: false` on
an individual modern server to opt out. A checkpointer is only required when a
tool actually elicits, while legacy servers answer elicitation through the new
`onElicitation` callback. Under `toolRetryMiddleware`, elicitation needs
`langchain` 1.5.15 or later; earlier versions treat the interrupt as a tool
failure.

Resuming replays the tool call from its first round, so the server is asked
again before it is answered: N questions cost O(N^2) requests, and servers and
hooks must be replay-safe. `beforeToolCall` runs once per execution, replays
included, and the adapter promises no exactly-once effects. Each resume gets a
fresh continuation from that replay, so a pause is not limited by any
`requestState` lifetime: the one issued before the pause may expire while the
graph waits.

Because the call replays, a server that asks something different the second
time is answered with what the human said the first time; like the Python
adapter, the adapter does not compare the two. A resume is parsed against the
question now being asked — exactly the server's keys, each answer against that
question's requested schema — so a missing, unexpected or malformed answer
fails the call rather than re-asking, since the caller resuming the graph is
code and not the human who filled the form.

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
server. Catalogs and connections are isolated by effective headers and auth
provider identity, so recreate the adapter when switching the account behind a
provider. `listTools([], { cacheMode: "refresh" | "bypass" })` drives the SDK's
discovery cache, and a failed refresh restores the previous catalog rather than
discarding a working one. `listResources()` and `listResourceTemplates()` now
throw a server's error, where 1.x logged it and returned `[]`; only a server
without resource templates still lists them as `[]`. `close()` also aborts in-flight
requests and pending reconnects; the adapter stays reusable.

### Server interactions

Per-server `resourceSubscriptions`, `logLevel` and `elicitation`, each rejected
where the protocol cannot serve them. `onCancelled` is removed: the SDK exposes
no seam that observes `notifications/cancelled` without displacing its own
dispatch, and replacing that handler stopped the SDK aborting the request it
was told about.

### Fixes

A background reconnection that exhausts its attempts now reports to an
`onConnectionError` function instead of failing silently. An `Authorization` header
configured alongside an `authProvider` is no longer joined with the provider's
token into a value servers reject. An `onProgress` callback that
throws no longer fails a tool call that already completed.
