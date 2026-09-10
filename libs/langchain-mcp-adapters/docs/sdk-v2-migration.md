# Migrating to MCP SDK 2

The adapter uses the stable `@modelcontextprotocol/client` 2.x package. Existing
legacy MCP servers remain supported over stdio, Streamable HTTP, and legacy SSE.
The SDK upgrade preserves legacy negotiation by default; modern protocol support
and elicitation require separate adapter features.

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
normalized to `transport` in the resolved configuration.

The adapter now requires Zod `^4.2.0`; its configuration validation errors are
Zod4 errors. Remove v3-only dependency overrides for this package. LangChain core
may still use Zod3 transitively. Recognition of caller-originated Zod errors uses
core's interoperability helper and does not import the v3 runtime here.

Callbacks are checked for callability during configuration. Notification
payloads use the SDK's types and validation; the adapter no longer reconstructs
and strips their fields through duplicate schemas. Hook modifications are
validated after awaiting the callback, for both synchronous and asynchronous
implementations. Return `undefined` for no change, `{ args, headers }` before a
call, or `{ result }` after it. Invalid return containers now fail consistently;
`Command` and `ToolMessage` values must be real native values. Detailed
`outputHandling` objects reject unknown content-type keys instead of silently
ignoring typos. Callback request `args` is a present field typed `unknown`.

`config` remains a snapshot using the legacy `mcpServers` field. Mutable options
are copied; callback functions and OAuth provider instances retain their
identity. Treat this as runtime configuration, not a JSON-serializable or
redacted diagnostic object. Changing a snapshot does not reconfigure the adapter.
