# Migrating to MCP SDK 2

The adapter uses the stable `@modelcontextprotocol/client` 2.x package. Existing
legacy MCP servers remain supported over stdio, Streamable HTTP, and legacy SSE.
Connections now default to modern protocol negotiation. Add `mode: "legacy"`
to each existing legacy server configuration; SDK package version 2 does not
mean a server uses the modern wire protocol.

## Applications using the adapter

The names `MultiServerMCPClient`, `mcpServers`, and `getTools()` remain compatibility
aliases, but their configurations follow the same new mode validation. Applications using these APIs do not need to construct an SDK client.

## Applications supplying an SDK client

`loadMcpTools()` now accepts an SDK 2 client, and `getClient()` returns an SDK 2
client. An SDK 1 client from `@modelcontextprotocol/sdk` is not interchangeable
with these clients. Migrate the imports and any direct SDK calls:

```ts
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { loadMcpTools } from "@langchain/mcp-adapters";

const client = new Client({ name: "my-agent", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["./server.js"],
});

try {
  await client.connect(transport);
  const tools = await loadMcpTools("local", client);
  // Supply tools to your agent and await its execution here.
  console.log(tools.map((tool) => tool.name));
} finally {
  await client.close();
}
```

Direct `client.callTool()` calls take request options as the second argument;
remove the old result-schema placeholder. Standard notification handlers use a
method string, such as `"notifications/message"`, instead of a schema argument.
HTTP SDK errors expose the HTTP status through `SdkHttpError.status`.

## OAuth providers

Existing `authProvider` configuration remains available. The provider type is
exported by the adapter:

```ts
import type { OAuthClientProvider } from "@langchain/mcp-adapters";
```

For custom providers, follow the SDK 2 provider contract and preserve all fields
passed to storage callbacks, including issuer information. Applications continue
to own credential storage, authorization redirects, and callback handling.

## Local server examples and runtimes

Server examples use `@modelcontextprotocol/server`, `@modelcontextprotocol/node`,
and `@modelcontextprotocol/server-legacy`. These are development dependencies of
the adapter, not runtime dependencies required by its consumers. The legacy SSE
package is used to exercise legacy-server interoperability.

Both the SDK client and adapter provide ESM and CommonJS exports. The adapter's
existing Node version requirement remains unchanged.

## Canonical API and Zod4

Rename `MultiServerMCPClient` to `MCPAdapter` and the configuration key
`mcpServers` to `servers`. Prefer `listTools()`; native LangChain tools and `close()` remain:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: {
    local: { transport: "stdio", command: "node", args: ["./server.js"] },
  },
});
try {
  const tools = await adapter.listTools();
  console.log(tools.map((tool) => tool.name));
} finally {
  await adapter.close();
}
```

The old class name is the same constructor, not a second implementation. Legacy
configuration names remain accepted; they do not bypass protocol validation. Use one server-map spelling and one transport
selection; conflicting forms and connections combining `command` with `url` fail during construction. Legacy `type` is
normalized to a required `transport` discriminator in the resolved configuration.
Use `connection.transport` to narrow resolved stdio, HTTP, or SSE options;
resolved connections no longer expose the legacy `type` alias.

The adapter now requires Zod `^4.2.0`; its configuration validation errors are
Zod4 errors. Remove v3-only dependency overrides for this package. LangChain core
may still use Zod3 transitively. Recognition of caller-originated Zod errors uses
core's interoperability helper and does not import the v3 runtime here.

Callbacks are checked for callability during configuration. Notification
payloads use the SDK's types and validation; the adapter no longer reconstructs
and strips their fields through duplicate schemas. Hook modifications are
validated after awaiting the callback, for both synchronous and asynchronous
implementations. Return `undefined` for no change, `{ args, headers }` before a
call, or `{ result }` after it. Argument overrides must be objects and are merged
without mutating the original request arguments. Invalid return containers now fail consistently;
`Command` and `ToolMessage` values must pass their framework predicates.
Content and artifact arrays now check each block's extensible `type`/optional
`id` boundary; embedded resource artifacts use the SDK's resource guard.
Provider-specific fields and existing data-block formats remain supported.
OAuth providers retain their identity, but their six required SDK methods must
be callable. Metadata getters remain lazy. Numeric timeout overrides in
`metadata.timeoutMs` are parsed before invoking the SDK. Detailed
`outputHandling` objects reject unknown content-type keys instead of silently
ignoring typos; explicit `undefined` destinations remain valid. Callback request `args` is a present field typed `unknown`.

`config` remains a snapshot using the legacy `mcpServers` field. Mutable options
are copied; callback functions and OAuth provider instances retain their
identity. Treat this as runtime configuration, not a JSON-serializable or
redacted diagnostic object. Changing a snapshot does not reconfigure the adapter.

Notification callbacks receive a fresh connection-options snapshot for each
event. Mutating that snapshot cannot reconfigure the adapter or alter the next
notification's options. OAuth providers retain their application-owned identity.
Direct legacy server maps can still contain a server named `servers`; the
constructor distinguishes a connection definition from the canonical wrapper.

Hook `state` is typed `unknown`: it is the unchanged LangGraph task input,
including arrays and primitives from functional entrypoints. Narrow or parse it
using your application schema before accessing fields. Calls outside LangGraph
continue to receive `{}`.

## Tool results, hooks and schemas

Tool content always uses standard LangChain blocks. Remove the
`useStandardContentBlocks` option from configuration. Images/audio use `data`
and `mimeType`; update code that reads the old `image_url`, `source_type`, or
`mime_type` fields. Artifact-routed blocks retain their original MCP shapes.

Keep protocol data in `ToolMessage.artifact`, not model-visible content:

| Artifact type            | Data                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `mcp_structured_content` | Structured output, including false, zero, null and arrays         |
| `mcp_meta`               | The result's `_meta` object                                       |
| `mcp_content`            | Original converted resources or blocks with extra protocol fields |

Blocks explicitly routed to artifacts remain in their original MCP format.
A no-op `afterToolCall` preserves these artifacts. Returning a `ToolMessage` or
LangGraph `Command` preserves that object, including message status and identity.
Graph interrupts propagate unchanged. A server result with `isError: true`
throws `ToolException` with the original response in `error.result`; transport
failures retain their original cause. Validation failures retain the original Zod error in
`error.cause`, including its structured `issues`. SDK argument-validation issues
are represented as Zod4 custom issues, preserving messages and paths. Catch the
outer tool failure using exported `isToolException`.

Arguments modified by `beforeToolCall` are now checked against the **original
server JSON Schema** before being sent. For example, a hook adding an undeclared
property fails if the server declares `additionalProperties: false`, even if the
model-facing schema override accepts it. Original descriptors are not mutated.

The adapter no longer flattens `allOf`/`anyOf`/`oneOf`, inlines `$ref`, or removes
conditional keywords. `tool.schema` preserves the server's JSON Schema. Your
model provider must support that schema: the Anthropic integration, for example,
omits tools containing root-level composition keywords. Publish a compatible
schema on the server, or explicitly set `tool.schema` before binding the tool to
your model. That override does not weaken post-hook validation against the
original server schema.

Core validates initial arguments against `tool.schema` before hooks run. Inputs
that previously passed a simplified schema may now fail before `beforeToolCall`.
Do not rely on hooks to repair initially invalid input unless you intentionally
provide a different model-facing schema.

The minimum core version is now `1.2.6`. `ToolException` extends core's branded
`LangChainError`; use `ToolException.isInstance(error)` or `isToolException(error)`
to narrow it. Both recognize errors from duplicate adapter modules but reject
name-only lookalikes. Zod issue formatting, `cause`, and `result` are preserved.

## Connection and discovery behavior

Tools and connections are isolated by server name, effective headers and OAuth
provider identity. Configured headers take precedence over discovery overrides;
a direct invocation hook's headers override its existing connection's headers.
Modern graph executions reject hook header overrides. Empty
fork overrides reuse the existing client. Default lookups cannot select another
request's identity. A tools-list notification invalidates only that connection's
catalog; separate OAuth providers remain separate even if their headers match.

Concurrent acquisition is deduplicated. Failed handshakes and failed discovery
release owned connections, and closing attempts every connection even if one
fails. Clients supplied to `loadMcpTools` remain owned by the caller.

Tool, resource, and template discovery delegates pagination to the SDK. Server
errors reject instead of appearing as an empty catalog. Resource conversion
never performs implicit reads; explicitly call
`readResource` if needed. Modern servers use the current revision by default; legacy servers require
`mode: "legacy"`. Modern elicitation uses LangGraph interrupts by default.

### Discovery freshness

`listTools()` consults the SDK cache each time and reuses adapted tools when the
returned descriptors are unchanged. The default `cacheMode: "use"` honors SDK
cache hints and TTL. Pass `listTools([], { cacheMode: "refresh" })` to fetch and
update the cache, or `"bypass"` to fetch without updating it. Existing tools held
by an agent are not mutated. Close and recreate the adapter when changing the
account associated with an OAuth provider.

## Separate modern and legacy server options

```ts
const adapter = new MCPAdapter({
  servers: {
    modern: { url: "https://example.com/mcp" },
    legacy: {
      mode: "legacy",
      url: "https://legacy.example.com/mcp",
      automaticSSEFallback: true,
      onMessage: (message) => console.log(message.data),
    },
  },
});
```

Omitting `mode` means `"modern"`. Modern connections require the SDK's current
modern protocol revision; there is no automatic fallback into legacy behavior.
Explicit legacy mode supports stdio, Streamable HTTP, and SSE. `transport: "sse"`,
`automaticSSEFallback`, and `onInitialized` require legacy mode. Invalid mode and
transport combinations, unknown options, and empty server maps fail with Zod
errors before opening a connection.

Move notification and progress callbacks from the adapter root into each server
that should receive them. Global LangChain tool hooks and naming/output policies
remain available. `onRootsListChanged` has been removed: roots notifications
originate from the client. Use tool arguments, resource URIs, or server
configuration to supply workspace paths instead. The protocol deprecates roots;
removing this observer does not mean the roots feature was removed from every
protocol implementation.

## Elicitation and request logging

Move `onElicitation` onto each legacy server that handles user input. Modern server
configuration rejects this callback and uses LangGraph interrupts by default.
Legacy callbacks execute within the active request.
Their answers are parsed with SDK schemas, with Zod issues preserving validation
paths. They cannot be resumed after the underlying connection closes.

Modern `logLevel` and `maxElicitationRounds` are server options, not adapter-wide
policies. Legacy configurations reject them; use `setLoggingLevel` for legacy
logging. Tool-catalog subscriptions keep caches fresh even without an application
notification callback.

## Checkpointed elicitation

Remove `elicitationMode`; modern tools use interrupts by default. Invoke the tool
inside a checkpointed LangGraph run when it can ask for input, and resume with
one answer for each pending question key. Direct calls outside a graph still work
when no input is requested. If the server asks for input, an outside-graph call
raises a helpful error; a graph without a checkpointer cannot resume that request.
Modern URL questions may omit legacy `elicitationId` values; use the pending
question key when answering them.

Legacy servers require explicit `mode: "legacy"` and a per-server `onElicitation`
callback. A pending legacy request cannot be resumed through this bridge, and
modern connections never fall back to legacy.

Keep authentication and headers in connection configuration for graph execution.
Modern tools running inside a graph reject `beforeToolCall` header overrides
before sending the request. Direct HTTP calls can still override headers. Preserve the same server, tool, and
authenticated account when reconstructing the adapter. The application owns
checkpoint storage and thread access. `MemorySaver` is an in-process example;
process recovery needs a persistent checkpointer. No exactly-once guarantee is
made for work performed before a checkpoint is saved. See the
[complete interrupt example](../README.md#durable-langgraph-elicitation).

## Completing OAuth authorization

Use `await adapter.finishAuth(serverName, callbackParams, expectedState)` with
the full redirect query parameters, including `iss` when present. The configured
provider must persist discovery state and the PKCE verifier. The adapter checks
state, delegates callback completion to the SDK, and clears the old connection
and catalog after success; call `listTools()` again to reconnect.

The application owns the redirect endpoint, one-time state consumption, user
binding, and credential storage. Keep each provider bound to one account and
preserve issuer information in storage. Local fixtures cover refresh, DCR/CIMD,
callback validation, and scope step-up; production identity-provider
interoperability is not implied. URL elicitation is separate from OAuth. See
[OAuth responsibilities](../README.md#oauth-responsibilities) and
[callback completion](../README.md#complete-an-oauth-callback).
