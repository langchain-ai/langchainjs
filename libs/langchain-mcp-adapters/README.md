# LangChain.js MCP Adapters

Use tools from [Model Context Protocol](https://modelcontextprotocol.io) servers
in LangChain and LangGraph. `MCPAdapter` manages connections to one or more
servers and returns executable LangChain tools.

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

## Durable modern elicitation

Modern servers can return `input_required` from a tool call. Inside a LangGraph
with a checkpointer, the adapter records each completed MCP round in a LangGraph
task, then interrupts with the form or URL question. Legacy `onElicitation`
callbacks remain separate and do not become durable graph interrupts.

Resume using the latest interrupt and the same thread:

```ts
import { Command } from "@langchain/langgraph";
import { createMCPElicitationResume } from "@langchain/mcp-adapters";

const paused = await agent.invoke(input, config);
const pending = paused.__interrupt__[0];

await agent.invoke(
  new Command({
    resume: createMCPElicitationResume(pending, {
      confirmation: { action: "accept", content: { confirmed: true } },
    }),
  }),
  config
);
```

Here `agent`, `input`, and `config` are application-owned; `confirmation` and
`confirmed` must match the server's input-request key and form schema. The helper
binds answers to both the graph interrupt and the displayed question attempt.
Invalid form answers produce another interrupt without another MCP request;
use that latest interrupt for the correction. `maxElicitationRounds` bounds all
question attempts, including corrections, and defaults to 32.

### Recovery after a long pause

No JavaScript stack, loop counter, adapter instance, or live connection is saved.
A new process reconstructs the adapter, tools, and graph from configuration and
resumes the same thread against the same persistent checkpointer. Completed
rounds come from saved task results; earlier answers reconstruct progression and
the original allowance. The initial MCP request is not repeated merely to
recover the pending question. `MemorySaver` alone cannot survive process loss.

For multi-day pauses:

- Retain checkpoints and pending task writes for longer than the pause, and await
  persistence before acknowledging it. Use LangGraph's `durability: "sync"` when
  synchronous checkpoint boundaries are required.
- Preserve compatible graph/task ordering and the same logical server endpoint,
  tool, and authorization scope across reconstruction. Changed effective tool
  arguments are rejected; server names alone do not establish authorization
  identity.
- Ensure the MCP server's continuation lifetime, retained state, and verification
  keys support the pause. Graph persistence does not extend `requestState`
  expiry. An invalid or expired continuation surfaces the server failure; the
  adapter does not silently restart the operation using old consent.
- An application request or other external event must invoke resume. A paused
  thread is stored data, not a worker waiting in memory.

`beforeToolCall` remains an execution-attempt hook and can run again on resume;
`afterToolCall` is not an exactly-once transaction. Hook-supplied header overrides
are supported for ordinary completed calls but not durable elicitation; configure
stable server authentication instead. A crash after a remote effect but before
its result is persisted can still repeat that effect. Servers must use idempotency
or reconciliation where exactly-once effects matter.

Continuation data is omitted from the public interrupt, but saved task results
can appear in internal graph streams and tracing. Treat these as execution data
and project only appropriate events to end-user interfaces. Credentials and live
client objects are not stored in round records.

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

MIT licensed. Originally adapted from
[Julien Blanchon's implementation](https://github.com/JulienBlanchon/langchain-mcp-adapter).
