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

Supply an application-owned `authProvider` implementing the exported
`OAuthClientProvider` interface. The official SDK handles OAuth discovery,
registration, exchange and refresh. Your application owns credential storage,
account binding, redirects and callback handling.

## Examples

- [Examples](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters/examples): local servers, mixed modes, agents and hooks.

`MultiServerMCPClient` and `mcpServers` input remain deprecated compatibility APIs.
Use `MCPAdapter` and `servers` for new code. Replace `getTools()` with `listTools()`
when upgrading from adapter 1.x.

MIT licensed.
