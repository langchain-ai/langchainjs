# LangChain.js MCP Adapters

Use tools from [Model Context Protocol](https://modelcontextprotocol.io) servers
in LangChain and LangGraph. `MCPAdapter` manages connections to one or more
servers and returns executable LangChain tools.

**Documentation**: To learn more about using MCP servers with LangChain, check
out [the docs](https://docs.langchain.com/oss/javascript/langchain/mcp).

## Install

```bash
npm install @langchain/mcp-adapters @langchain/core @langchain/langgraph
```

The adapter includes the official MCP SDK client. Install the SDK separately
only when your application imports it directly.

## Connect and invoke a tool

Start the [local modern server example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/modern_server.ts),
then invoke its `echo` tool without a model:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: { local: { url: "http://127.0.0.1:3001/mcp" } },
});

try {
  const tools = await adapter.listTools();
  const echo = tools.find((tool) => tool.name === "echo");
  if (!echo) throw new Error("The server did not provide echo");

  const result = await echo.invoke({ message: "Hello MCP" });
  console.log(result);
} finally {
  await adapter.close();
}
```

For your own server, replace the URL, tool name and arguments. `listTools()`
returns LangChain tools, which you can pass directly to `createAgent`'s `tools`
option. See the [agent example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/langgraph_example.ts).
Install `langchain` and configure your model credentials for agent usage. Keep
the adapter open until the agent finishes using its tools.

## Mix modern and legacy servers

Omit `mode` to let the SDK negotiate with each server automatically:

```ts
const adapter = new MCPAdapter({
  prefixToolNameWithServerName: true,
  servers: {
    modern: { url: "https://example.com/mcp" },
    legacy: {
      command: "node",
      args: ["./legacy-server.js"],
    },
  },
});
```

Prefix names when servers expose identically named tools. Set `mode: "legacy"`
to skip probing and enable legacy options such as `onElicitation` and
`onInitialized`. Set `mode: "modern"` to require MCP revision
[`2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28)
without fallback. SDK 2 can serve either protocol.

## Configuration and lifecycle

Construction validates options with Zod 4 and opens no connections. Discovery
and invocation open connections as needed. Use `listTools("serverName")` to
select tools and always await `close()` when finished.

`adapter.config.servers` exposes an isolated configuration snapshot. Changing
the snapshot does not reconfigure the adapter. Notification callbacks, tool hooks,
and auth provider instances retain their identity; the snapshot is runtime configuration,
not a redacted diagnostic object.

Put notification and progress callbacks on the server that should receive them.
Global tool hooks, naming, output routing and load-error policies remain adapter
options. Invalid mode/transport combinations fail before opening a connection.

## Tool results and hooks

Tool content uses standard LangChain blocks. Images and audio expose `data` and
`mimeType`; artifact-routed blocks retain their MCP representation.
`outputHandling` controls what reaches the model versus the tool artifact.

Use `beforeToolCall` and `afterToolCall` to modify arguments or results. See the
[hooks example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/hooks.ts)
for argument and result hooks.

## Authentication

`authProvider` takes either SDK provider shape:

- `{ token, onUnauthorized? }` (`AuthProvider`) for tokens your application
  manages. `token()` runs before every request; `onUnauthorized()` runs on a
  401 before the request is retried. Over SSE the SDK calls it again every
  time the reconnect is rejected, so throw from it when you have no newer
  token.
- An `OAuthClientProvider` for OAuth. The SDK handles discovery, registration,
  exchange and refresh; your application owns storage, redirects and the
  callback. Implement `invalidateCredentials()` so a refresh the server
  rejects restarts the login instead of failing. Implement
  `saveDiscoveryState()` / `discoveryState()` too, persisted alongside the
  code verifier: it's required when the authorization server is only
  discoverable from the 401 challenge, and it lets the SDK check that the
  callback comes from the authorization server the login started with.

When a connection needs a login, the SDK calls `redirectToAuthorization()`.
Complete the redirect with the SDK directly — the adapter has no
`finishAuth` of its own — using the same provider (the same storage) the
adapter's server config uses:

```ts
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

// In your OAuth callback route, with the same provider (same storage) the adapter uses:
const params = new URL(req.url).searchParams;
if (params.get("state") !== savedState) throw new Error("state mismatch"); // the SDK doesn't check state
const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
  authProvider,
});
await transport.finishAuth(params); // validates iss (RFC 9207), exchanges the code, saves tokens via the provider
await transport.close();
// The next adapter discovery or tool call connects with the saved tokens.
```

Use `SSEClientTransport` instead for a server configured with
`transport: "sse"`. `@modelcontextprotocol/client` is a dependency of the
adapter, but your app still needs its own direct dependency to import it
(see Install, above).

The callback route doesn't need an `MCPAdapter`, only a provider that reads
and writes the same durable storage as the one on the adapter's server
config. Don't start another discovery while a login is pending: it begins
a new redirect and invalidates the first callback. Make the callback
single-use: look up and delete the pending `state` before calling
`finishAuth`, and don't call it for a `state` that's already gone.
Otherwise a refresh, a double-invoked handler, or a back-button replay
redeems the same code twice, and the SDK responds by discarding the
tokens the first call just saved, logging the user out.

Don't display the SDK's own error text to users. `IssuerMismatchError`
carries the callback's `iss`, which an attacker controls in a mix-up
attack, and `OAuthError` can carry the authorization server's
`error_description`. Catch the callback failure and show your own generic
message instead.

A connection rejected for credentials throws an `MCPClientError`. Its `cause`
is the SDK's `UnauthorizedError` when the SDK can't recover on its own (an
OAuth login is needed, or a token provider has no `onUnauthorized`), or an
HTTP 401 error (`SdkHttpError`, `status: 401`) when the retry after
`onUnauthorized` or a token refresh is still rejected.

Once a provider has a token it replaces a configured `Authorization` header;
until then the header is sent. The SDK also forwards a configured static
`Authorization` header to the authorization server's discovery, registration
and token endpoints, not only to the MCP server, so don't pair a secret API
key with an OAuth provider whose authorization server lives on another
origin.

A per-call `authProvider` or `headers` override applies to every HTTP and SSE
server the adapter holds, not only the one you named. Each distinct provider
object also gets its own connection, kept until `close()`. Reuse one provider
object per user rather than creating one per call, and use a single-server
adapter when different users need different credentials.

## Examples

- [Examples](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters/examples): local servers, mixed modes, agents and hooks.

`MultiServerMCPClient` and `mcpServers` input remain deprecated compatibility APIs.
Use `MCPAdapter` and `servers` for new code. Replace `getTools()` with `listTools()`
when upgrading from adapter 1.x.

MIT licensed.
