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

## Modern elicitation

Modern servers can return `input_required` from a tool call. Opt a server in
with `elicitation: true`; inside a LangGraph with a checkpointer the adapter
raises the form or URL question as an `interrupt()`. Legacy `onElicitation`
callbacks remain separate and do not become graph interrupts.

```ts
const adapter = new MCPAdapter({
  servers: { modern: { url: "http://localhost:8000/mcp", elicitation: true } },
});
```

Resume using the latest interrupt and the same thread:

```ts
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import {
  createMCPElicitationResume,
  type MCPElicitationInterrupt,
} from "@langchain/mcp-adapters";

const paused = await agent.invoke(input, config);

if (isInterrupted<MCPElicitationInterrupt>(paused)) {
  const [pending] = paused[INTERRUPT];

  await agent.invoke(
    new Command({
      resume: createMCPElicitationResume(pending, {
        confirmation: { action: "accept", content: { confirmed: true } },
      }),
    }),
    config
  );
}
```

Here `agent`, `input`, and `config` are application-owned; `confirmation` and
`confirmed` must match the server's input-request key and form schema. Answers
are parsed against the question being asked when the graph resumes: exactly the
server's keys, and each answer against that question's requested schema. A
missing, unexpected, or malformed answer fails the tool call rather than
re-asking, since the caller resuming the graph is code, not the human who
filled the form.

Resuming replays the call, so the server is asked again before it is answered.
The adapter does not compare the second question with the first: if a server
asks something different on resume, the human's earlier answer is what it
receives. Servers whose questions depend on state that can change between
rounds should carry that state in `requestState` rather than re-deriving it.

### Resuming replays the call

Resuming re-issues the tool call from its first round, so the server is asked
again before it is answered and each round trip costs one extra request. A
server that asks before doing work repeats nothing; one that works first repeats
that work. Remote effects must be idempotent.

Because the call is replayed rather than restored, the server always issues a
fresh continuation, so a pause cannot outlive a `requestState` lifetime. Nothing
about the pending question is checkpointed beyond the interrupt payload itself,
and that payload carries the server's questions but never its opaque
continuation state.

`beforeToolCall` runs once per execution, replays included, so any header
identity it supplies is re-derived on resume rather than reused from the pause.
`afterToolCall` is not an exactly-once transaction. An application request or
other external event must invoke resume: a paused thread is stored data, not a
worker waiting in memory.

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
