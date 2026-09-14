# MCP adapter reference

For setup and a direct tool call, start with the [README](../README.md).
For breaking changes and compatibility aliases, see the [migration guide](sdk-v2-migration.md).

## Manage the MCP client yourself

Use `loadMcpTools()` when your application owns the SDK client lifecycle.
It returns executable LangChain tools that can be passed to `createAgent`.

This is an optional advanced API. `MCPAdapter` manages the SDK client
for you and does not require a separate SDK installation. Install
`@modelcontextprotocol/client` directly only when your application imports and
constructs its own SDK client, as this example does.

```bash
npm install @langchain/mcp-adapters @langchain/langgraph @langchain/core langchain @langchain/openai @modelcontextprotocol/client
```

Start the [local modern server](../examples/modern_server.ts) and configure
`OPENAI_API_KEY` before running this agent example.

```ts
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { loadMcpTools } from "@langchain/mcp-adapters";

// Initialize the ChatOpenAI model
const model = new ChatOpenAI({ model: "gpt-4o-mini" });

const transport = new StreamableHTTPClientTransport(
  new URL("http://127.0.0.1:3001/mcp")
);

// Initialize the client
const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

try {
  // Connect to the transport
  await client.connect(transport);

  // Get tools with custom configuration
  const tools = await loadMcpTools("local", client, {
    // Whether to throw errors if a tool fails to load (optional, default: true)
    throwOnLoadError: true,
    // Whether to prefix tool names with the server name (optional, default: false)
    prefixToolNameWithServerName: false,
    // Optional additional prefix for tool names (optional, default: "")
    additionalToolNamePrefix: "",
  });

  // Create and run the agent
  const agent = createAgent({ model, tools });
  const agentResponse = await agent.invoke({
    messages: [{ role: "user", content: "Use echo to say Hello MCP." }],
  });
  console.log(agentResponse);
} catch (e) {
  console.error(e);
} finally {
  // Clean up connection
  await client.close();
}
```

For runnable clients and servers, see the [examples](../examples) directory.

## Notifications and Progress

You can subscribe to server notifications and tool progress events on the server configuration that owns them. Callbacks are not top-level adapter options.

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const client = new MCPAdapter({
  servers: {
    everything: {
      mode: "legacy",
      transport: "stdio",
      // Receive log/notification messages from the server
      onMessage: (log, source) => {
        console.log(`[${source.server}] ${log.data}`);
      },

      // Receive progress updates (e.g. from long‑running tool calls)
      onProgress: (progress, source) => {
        const pct =
          progress.progress != null && progress.total
            ? Math.round((progress.progress / progress.total) * 100)
            : undefined;
        if (pct != null) {
          const origin =
            source.type === "tool"
              ? `${source.server}/${source.name}`
              : "unknown";
          console.log(`[progress:${origin}] ${pct}%`);
        }
      },

      // Optional: react to server-side list changes
      onToolsListChanged: (source) => {
        console.log(`[${source.server}] tools changed`);
      },
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    },
  },
});

const tools = await client.listTools();
// ... invoke tools as usual ...
await client.close();
```

Available notification callbacks you can register:

- **onMessage**: server log/diagnostic messages
- **onProgress**: progress events (`progress` and optional `total`) with `source` describing origin (e.g., tool name/server)
- **onInitialized**: legacy only; **onCancelled**: cancellation notifications not consumed by the SDK
- **onPromptsListChanged**, **onResourcesListChanged**, **onResourcesUpdated**, **onToolsListChanged**

## Tool Hooks (modify args/results)

Use hooks to customize tool calls. This example uses the local modern server's
`echo` tool and invokes it directly:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const client = new MCPAdapter({
  servers: {
    local: { url: "http://127.0.0.1:3001/mcp" },
  },

  // Change args/headers before the tool call
  beforeToolCall: ({ name }) => {
    if (name !== "echo") return;
    // Overrides are merged with the original arguments by the adapter.
    // For HTTP/SSE transports, you may also add per-call headers
    return {
      args: { message: "Hello from the hook" },
      headers: { "X-Request-ID": crypto.randomUUID() },
    };
  },

  // Change the tool result after execution
  afterToolCall: (res) => {
    // Option A: return a 2‑tuple [content, artifact]
    if (res.name === "someTool") return { result: ["modified-output", []] };

    // Option B: return a LangChain ToolMessage
    // return { result: new ToolMessage({ content: "overridden", tool_call_id: "id" }) };

    // Option C: return a LangGraph Command instance
    // return { result: new Command(...) }

    // Or pass-through (no change)
    return { result: res.result };
  },
});

try {
  const tools = await client.listTools();
  const echo = tools.find((tool) => tool.name === "echo");
  if (!echo) throw new Error("The server did not provide echo");
  console.log(await echo.invoke({ message: "Hello MCP" }));
} finally {
  await client.close();
}
```

Notes:

- **beforeToolCall** can return `{ args?, headers? }`. Headers are supported for HTTP/SSE. Stdio connections do not support custom headers.
- **afterToolCall** may return `{ result }`, where `result` is a string, a 2‑tuple `[content, artifact]`, a `ToolMessage`, or a `Command`. Return nothing to keep the original result.

## Tool Configuration Options

> [!TIP]
> Tool content always uses standard LangChain blocks. Use `outputHandling` to choose which outputs reach the model.

These tool options work with `loadMcpTools` and `MCPAdapter`.
`onConnectionError` is an adapter-only option because the adapter owns connections.

| Option                         | Type                                   | Default                                               | Description                                                                                          |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `throwOnLoadError`             | `boolean`                              | `true`                                                | Whether to throw an error if a tool fails to load                                                    |
| `prefixToolNameWithServerName` | `boolean`                              | `false`                                               | If true, prefixes all tool names with the server name (e.g., `serverName__toolName`)                 |
| `additionalToolNamePrefix`     | `string`                               | `""`                                                  | Additional prefix to add to tool names (e.g., `prefix__serverName__toolName`)                        |
| `outputHandling`               | `"content"`, `"artifact"`, or `object` | `resource` -> `"artifact"`, all others -> `"content"` | See [Tool Output Mapping](#tool-output-mapping)                                                      |
| `defaultToolTimeout`           | `number`                               | `0`                                                   | Default timeout for all tools (overridable on a per-tool basis)                                      |
| `onConnectionError`            | `"throw"` \| `"ignore"` \| `Function`  | `"throw"`                                             | Behavior when a server fails to connect. See [Connection Error Handling](#connection-error-handling) |

## Tool Output Mapping

> [!TIP]
> Leave `outputHandling` undefined for the defaults. Configure it when large outputs or media should be available to your application without being sent to the model.

MCP tools return arrays of content blocks. A content block can contain text, an image, audio, or an embedded resource. The right way to map these outputs into LangChain `ToolMessage` objects can differ based on the needs of your application, which is why the adapter provides the `outputHandling` option.

The `outputHandling` field allows you to specify whether a given type of content should be sent to the LLM, or set aside for some other part of your application to use in some future processing step (e.g. to use a dataframe from a database query in a code execution environment).

### Standardizing the Format of Tool Outputs

Model-visible images and audio use LangChain's native blocks:
`{ type: "image", data, mimeType }` and `{ type: "audio", data, mimeType }`.

Text stays text, and embedded resources are converted according to their MIME
type. Artifact-routed blocks retain their original MCP format. Conversion does
not fetch resource links; call `readResource` explicitly when needed.

A single plain-text result is returned as a string. Other content is returned as
an array of blocks; `ToolMessage.artifact` holds outputs routed away from the model.

### Determining Which Tool Outputs will be Visible to the LLM

The `outputHandling` option allows you to determine which tool output types are assigned to `ToolMessage.content`, and which are assigned to `ToolMessage.artifact`. Data in [`ToolMessage.content`](https://v03.api.js.langchain.com/classes/_langchain_core.messages_tool.ToolMessage.html#content) is used as input context when the LLM is invoked, while [`ToolMessage.artifact`](https://v03.api.js.langchain.com/classes/_langchain_core.messages_tool.ToolMessage.html#artifact) is not.

**By default** `@langchain/mcp-adapters` maps MCP `resource` content blocks to `ToolMessage.artifact`, and maps all other MCP content block types to `ToolMessage.content`. See [Standardizing the Format of Tool Outputs](#standardizing-the-format-of-tool-outputs) for the resulting shapes.

> [!TIP]
> Examples where `ToolMessage.artifact` can be useful include cases when you need to send multimodal tool outputs via `HumanMessage` or `SystemMessage` because the LLM provider API doesn't accept multimodal tool outputs, or cases where one tool might produce a large output to be indirectly manipulated by some other tool (e.g. a query tool that loads dataframes into a Python code execution environment).

The `outputHandling` option can be assigned to `"content"`, `"artifact"`, or an object that maps MCP content block types to either `content` or `artifact`.

When working with `MCPAdapter`, the `outputHandling` field can be assigned to the top-level config object and/or to individual server entries in `servers`. Entries in `servers` override those in the top-level config, and entries in the top-level config override the defaults.

For example, consider the following configuration:

```typescript
const clientConfig = {
  outputHandling: {
    image: "artifact",
    audio: "artifact",
  },
  servers: {
    camera: {
      url: "https://camera.example.com/mcp",
      outputHandling: {
        image: "content",
      },
    },
    microphone: {
      url: "https://microphone.example.com/mcp",
      outputHandling: {
        audio: "content",
      },
    },
  },
};
```

When calling tools from the `camera` MCP server, the following `outputHandling` config will be used:

```typescript
{
  text: "content", // default
  image: "content", // default and top-level config overridden by "camera" server config
  audio: "artifact", // default overridden by top-level config
  resource: "artifact", // default
}
```

Similarly, when calling tools on the `microphone` MCP server, the following `outputHandling` config will be used:

```typescript
{
  text: "content", // default
  image: "artifact", // default overridden by top-level config
  audio: "content", // default and top-level config overridden by "microphone" server config
  resource: "artifact", // default
}
```

## Tool Timeout Configuration

### Using `defaultToolTimeout`

Set `defaultToolTimeout` on the adapter or an individual server, in milliseconds.

A top-level `defaultToolTimeout` takes precedence over server-level defaults.
When the top-level setting is omitted, each server uses its own default. A
tool-specific timeout can override the resulting default.

```typescript
const client = new MCPAdapter({
  servers: {
    "data-processor": {
      command: "python",
      args: ["data_server.py"],
      defaultToolTimeout: 30000, // used when no top-level default is set
    },
    "image-processor": {
      transport: "stdio",
      command: "node",
      args: ["image_server.js"],
      // timeout will be 10 seconds (set in the top-level config)
    },
  },
  defaultToolTimeout: 10000, // 10 seconds
});

const tools = await client.listTools();
const slowTool = tools.find((t) => t.name.includes("process_large_dataset"));
if (!slowTool)
  throw new Error("The server did not provide process_large_dataset");

// Will timeout after 10 seconds (the top-level defaultToolTimeout)
const result = await slowTool.invoke({ dataset: "huge_file.csv" });
await client.close();
```

### Using `withConfig`

MCP tools support timeout configuration through LangChain's standard `RunnableConfig` interface. This allows you to set custom timeouts on a per-tool-call basis:

```typescript
const client = new MCPAdapter({
  servers: {
    "data-processor": {
      command: "python",
      args: ["data_server.py"],
    },
  },
});

const tools = await client.listTools();
const slowTool = tools.find((t) => t.name.includes("process_large_dataset"));
if (!slowTool)
  throw new Error("The server did not provide process_large_dataset");

// You can use withConfig to set tool-specific timeouts before handing
// the tool off to a LangGraph ToolNode or some other part of your
// application
const slowToolWithTimeout = slowTool.withConfig({ timeout: 300000 }); // 5 min timeout

// This invocation will respect the 5 minute timeout
const result = await slowToolWithTimeout.invoke({ dataset: "huge_file.csv" });

// or you can invoke directly without withConfig
const directResult = await slowTool.invoke(
  { dataset: "huge_file.csv" },
  { timeout: 300000 }
);

await client.close();
```

Timeouts can be configured using the following `RunnableConfig` fields:

| Parameter | Type        | Default   | Description                                                   |
| --------- | ----------- | --------- | ------------------------------------------------------------- |
| `timeout` | number      | 60000     | Timeout in milliseconds for the tool call                     |
| `signal`  | AbortSignal | undefined | An AbortSignal that, when asserted, will cancel the tool call |

## OAuth 2.0 Authentication

Pass an `authProvider` implementing the SDK's `OAuthClientProvider` contract.
The SDK handles discovery, registration, token exchange, and refresh. Your
application supplies storage and redirect handling. `OAuthClientProvider` is an
interface; supply your application's implementation:

```ts
import { MCPAdapter, type OAuthClientProvider } from "@langchain/mcp-adapters";

function createAuthenticatedAdapter(authProvider: OAuthClientProvider) {
  return new MCPAdapter({
    servers: {
      secure: {
        url: "https://secure-mcp-server.example.com/mcp",
        authProvider,
      },
    },
  });
}
```

Create a provider for the authenticated user and server. Keep it bound to that
account for the adapter's lifetime. The provider owns credential storage,
issuer/account isolation, Proof Key for Code Exchange (PKCE) state, and handing
authorization URLs to the application. The adapter does not open a browser or
host an authorization callback.

## Reconnection Strategies

Both transport types support automatic reconnection:

### Stdio Transport Restart

```ts
{
  mode: "legacy",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-math"],
  restart: {
    enabled: true,      // Enable automatic restart
    maxAttempts: 3,     // Maximum restart attempts
    delayMs: 1000       // Delay between attempts in ms
  }
}
```

### SSE Transport Reconnect

```ts
{
  mode: "legacy",
  transport: "sse",
  url: "https://example.com/mcp-server",
  reconnect: {
    enabled: true,      // Enable automatic reconnection
    maxAttempts: 5,     // Maximum reconnection attempts
    delayMs: 2000       // Delay between attempts in ms
  }
}
```

## Error Handling

The library provides different error types to help with debugging:

- **MCPClientError**: For client connection and initialization issues
- **ToolException**: For errors during tool execution
- **ZodError**: For configuration validation errors (invalid connection settings, etc.)

Example error handling:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";
import { isInteropZodError } from "@langchain/core/utils/types";

let client: MCPAdapter | undefined;
try {
  client = new MCPAdapter({
    servers: {
      math: {
        mode: "legacy",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-math"],
      },
    },
  });

  const tools = await client.listTools();
  if (!tools[0]) throw new Error("No tools available");
  const result = await tools[0].invoke({ expression: "1 + 2" });
  console.log(result);
} catch (error) {
  if (isInteropZodError(error)) {
    console.error("Configuration error:", error);
  } else {
    // Connection and tool errors retain their original cause for inspection.
    console.error("MCP operation failed:", error);
  }
} finally {
  await client?.close();
}
```

### Common Zod Validation Errors

The library uses Zod for validating configuration. Here are some common validation errors:

- **Missing required parameters**: For example, omitting `command` for stdio transport or `url` for SSE transport
- **Invalid parameter types**: For example, providing a number where a string is expected
- **Invalid connection configuration**: For example, using an invalid URL format for SSE transport

Inspect `error.issues` for structured paths and messages rather than matching
formatted error text. Use `z.prettifyError(error)` for a readable display. Zod4
issue codes differ from Zod3; avoid relying on the old `invalid_string` URL code.

### Connection Error Handling

By default, the `MCPAdapter` will throw an error if any server fails to connect (`onConnectionError: "throw"`). You can change this behavior by setting `onConnectionError: "ignore"` to skip failed servers, or provide a custom error handler function:

- `"throw"` (default): Throw an error immediately if any server fails to connect
- `"ignore"`: Skip failed servers and continue with successfully connected ones
- `Function`: Custom error handler that receives the server name and error. If the handler throws, the error is bubbled through. If it returns normally, the server is treated as ignored.

When set to `"ignore"` or a custom handler that doesn't throw:

- Servers that fail to connect are skipped and logged as warnings
- The client continues to work with only the servers that successfully connected
- Failed servers are skipped until the adapter is closed and reopened
- If no servers successfully connect, a warning is logged but no error is thrown

```ts
const client = new MCPAdapter({
  servers: {
    "working-server": {
      url: "http://127.0.0.1:3001/mcp", // Start modern_server.ts first
    },
    "broken-server": {
      transport: "http",
      url: "http://localhost:9999/mcp", // This server doesn't exist
    },
  },
  onConnectionError: "ignore", // Skip failed connections
});

// This won't throw even though "broken-server" fails to connect
const tools = await client.listTools(); // Only tools from "working-server"

// You can check which servers are actually connected
const workingClient = await client.getClient("working-server"); // Returns client
const brokenClient = await client.getClient("broken-server"); // Returns undefined
```

You can also provide a custom error handler function for more control:

```ts
const client = new MCPAdapter({
  servers: {
    "critical-server": {
      transport: "http",
      url: "http://localhost:8000/mcp",
    },
    "optional-server": {
      transport: "http",
      url: "http://localhost:8001/mcp",
    },
  },
  onConnectionError: ({ serverName, error }) => {
    // Throw for critical servers, ignore for optional ones
    if (serverName === "critical-server") {
      throw new Error(`Critical server ${serverName} failed: ${error}`);
    }
    // For optional servers, just log and continue
    console.warn(`Optional server ${serverName} failed, continuing...`);
  },
});
```

In this example:

- If `critical-server` fails, the error handler throws and the error is bubbled through
- If `optional-server` fails, the error handler logs a warning and returns normally, so the server is ignored

### Debug Logging

This package makes use of the [debug](https://www.npmjs.com/package/debug) package for debug logging.

Logging is disabled by default, and can be enabled by setting the `DEBUG` environment variable as per
the instructions in the debug package.

To output all debug logs from this package:

```bash
DEBUG='@langchain/mcp-adapters:*'
```

To output debug logs only from the `client` module:

```bash
DEBUG='@langchain/mcp-adapters:client'
```

To output debug logs only from the `tools` module:

```bash
DEBUG='@langchain/mcp-adapters:tools'
```
