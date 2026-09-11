# Migrating to MCP SDK 2

The adapter uses the stable `@modelcontextprotocol/client` 2.x package. Existing
legacy MCP servers remain supported over stdio, Streamable HTTP, and legacy SSE.
HTTP and stdio connections negotiate modern or legacy protocols automatically;
explicit SSE connections use legacy negotiation. A single adapter can connect
to both generations. SDK 2.0.0 is a package version, not a protocol revision.

## Applications using the adapter

Existing `MultiServerMCPClient` configuration, `getTools()`, and `close()` remain
available. Applications using these APIs do not need to construct an SDK client.

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
`mcpServers` to `servers`. Keep `getTools()`, native LangChain tools and `close()`:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: {
    local: { transport: "stdio", command: "node", args: ["./server.js"] },
  },
});
try {
  const tools = await adapter.getTools();
  console.log(tools.map((tool) => tool.name));
} finally {
  await adapter.close();
}
```

The old class name is the same constructor, not a second implementation. Legacy
configuration remains accepted. Use one server-map spelling and one transport
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
failures retain their original cause. Catch using exported `isToolException`.

Arguments modified by `beforeToolCall` are now checked against the **original
server JSON Schema** before being sent. For example, a hook adding an undeclared
property fails if the server declares `additionalProperties: false`, even if the
model-facing projection accepts it. Projection cannot remove server constraints.
Original descriptors are not mutated.

## Connection and discovery behavior

Tools and connections are isolated by server name, effective headers and OAuth
provider identity. Configured headers take precedence over discovery overrides;
an invocation hook's headers override its existing connection's headers. Empty
fork overrides reuse the existing client. Default lookups cannot select another
request's identity. A tools-list notification invalidates only that connection's
catalog; separate OAuth providers remain separate even if their headers match.

Concurrent acquisition is deduplicated. Failed handshakes and failed discovery
release owned connections, and closing attempts every connection even if one
fails. Clients supplied to `loadMcpTools` remain owned by the caller.

Tool, resource, and template discovery delegates pagination to the SDK. Server
errors reject instead of appearing as an empty catalog. Resource conversion
never performs implicit reads; explicitly call
`readResource` if needed.

### Discovery freshness

`getTools()` consults the SDK cache each time and reuses adapted tools when the
returned descriptors are unchanged. The default `cacheMode: "use"` honors SDK
cache hints and TTL. Pass `getTools([], { cacheMode: "refresh" })` to fetch and
update the cache, or `"bypass"` to fetch without updating it. Existing tools held
by an agent are not mutated. Close and recreate the adapter when changing the
account associated with an OAuth provider.


## Protocol negotiation and callbacks

Leave `protocolVersion` unset for automatic HTTP/stdio negotiation. Set it to
`"legacy"` to require the legacy handshake, or `{ pin: "2026-07-28" }` to require
that modern revision. Existing legacy servers do not need to upgrade with the
adapter.

Use `onElicitation` for form and URL requests. The callback returns an accepted,
declined, or cancelled answer; accepted form content must match the requested
schema. The SDK handles modern continuation rounds and legacy reverse requests.
Do not call LangGraph `interrupt()` inside this callback. See the README's
[protocol and elicitation guide](../README.md#protocol-negotiation-and-elicitation).

Modern catalog-change callbacks open an SDK subscription when the server
advertises support; subscription setup failures reject the connection. Set
`logLevel` globally or per server to request modern tool-call logs.
`setLoggingLevel()` is legacy-only and rejects modern connections.
