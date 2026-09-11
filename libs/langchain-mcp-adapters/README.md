# LangChain.js MCP Adapters

> This version uses the stable MCP TypeScript SDK 2.x. Legacy MCP servers remain
> supported. Applications supplying their own SDK client must migrate to
> `@modelcontextprotocol/client`; see [the SDK migration guide](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/docs/sdk-v2-migration.md).
> Upgrading the SDK alone does not enable modern stateless elicitation.

[![npm version](https://img.shields.io/npm/v/@langchain/mcp-adapters.svg)](https://www.npmjs.com/package/@langchain/mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This library provides a lightweight wrapper that makes [Anthropic Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) tools compatible with [LangChain.js](https://github.com/langchain-ai/langchainjs) and [LangGraph.js](https://github.com/langchain-ai/langgraphjs).

## Features

- 🔌 **Transport Options**
  - Connect to MCP servers via stdio (local) or Streamable HTTP (remote)
    - Streamable HTTP automatically falls back to SSE for compatibility with legacy MCP server implementations
  - Support for custom headers in SSE connections for authentication
  - Configurable reconnection strategies for both transport types

- 🔄 **Multi-Server Management**
  - Connect to multiple MCP servers simultaneously
  - Auto-organize tools by server or access them as a flattened collection

- 🧩 **Agent Integration**
  - Compatible with LangChain.js and LangGraph.js
  - Optimized for OpenAI, Anthropic, and Google models
  - Supports rich content responses including text, images, and embedded resources

- 🛠️ **Development Features**
  - Uses `debug` package for debug logging
  - Flexible configuration options
  - Robust error handling

## Installation

```bash
npm install @langchain/mcp-adapters
```

## Connect to one or more servers

The library allows you to connect to one or more MCP servers and load tools from them, without needing to manage your own MCP client instances.

```ts
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MCPAdapter, type OAuthClientProvider } from "@langchain/mcp-adapters";

// Supply your application-owned OAuth provider; see OAuth setup below.
declare const authProvider: OAuthClientProvider;

// Create client and connect to server
const client = new MCPAdapter({
  // Global tool configuration options
  // Whether to throw on errors if a tool fails to load (optional, default: true)
  throwOnLoadError: true,
  // Avoid tool-name collisions when servers expose tools with the same name
  prefixToolNameWithServerName: true,
  // Optional additional prefix for tool names (optional, default: "")
  additionalToolNamePrefix: "",

  // Behavior when a server fails to connect: "throw" (default) or "ignore"
  onConnectionError: "ignore",

  // Server configuration
  servers: {
    // adds a STDIO connection to a server named "math"
    math: {
      mode: "legacy",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-math"],
      // Restart configuration for stdio transport
      restart: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 1000,
      },
    },

    // here's a filesystem server
    filesystem: {
      mode: "legacy",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    },

    // Modern Streamable HTTP transport with authentication headers
    weather: {
      url: "https://example.com/weather/mcp",
      headers: {
        Authorization: "Bearer token123",
      },
    },

    // OAuth 2.0 authentication (recommended for secure servers)
    "oauth-protected-server": {
      url: "https://protected.example.com/mcp",
      authProvider,
      // Can still include custom headers for non-auth purposes
      headers: {
        "User-Agent": "My-MCP-Client/1.0",
      },
    },

    // Explicit legacy SSE endpoint
    github: {
      mode: "legacy",
      transport: "sse", // also works with "type" field instead of "transport"
      url: "https://example.com/mcp",
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 2000,
      },
    },
  },
});

const tools = await client.listTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// Create the React agent
const agent = createAgent({
  model,
  tools,
});

// Run the agent
try {
  const mathResponse = await agent.invoke({
    messages: [{ role: "user", content: "what's (3 + 5) x 12?" }],
  });
  console.log(mathResponse);
} finally {
  await client.close();
}
```

Construction validates configuration; discovery and invocation open connections.
No MCP SDK import is needed for this workflow. Connections default to `mode: "modern"`
and require the current modern protocol. Set `mode: "legacy"` for a legacy
stdio, Streamable HTTP, or SSE server. Modern connections never fall back to SSE.

`MultiServerMCPClient` is a deprecated alias of `MCPAdapter`. Existing
`mcpServers` and direct server-map configurations remain accepted; new code
should use `servers` and `listTools()`. `getTools()` remains a compatibility alias.
The old constructor names use the same mode validation. Do not combine `servers` with `mcpServers`, or conflicting
`transport` and legacy `type` values. See the [migration guide](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/docs/sdk-v2-migration.md)
for Zod4, callback and configuration changes.

# Example: Manage the MCP Client yourself

This example shows how you can manage your own MCP client and use it to get LangChain tools. These tools can be used anywhere LangChain tools are used, including with LangGraph prebuilt agents, as shown below.

This is an optional advanced API. `MCPAdapter` manages the SDK client
for you and does not require a separate SDK installation. Install
`@modelcontextprotocol/client` directly only when your application imports and
constructs its own SDK client, as this example does.

```bash
npm install @langchain/mcp-adapters @langchain/langgraph @langchain/core @langchain/openai @modelcontextprotocol/client

export OPENAI_API_KEY=<your_api_key>
```

```ts
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { loadMcpTools } from "@langchain/mcp-adapters";

// Initialize the ChatOpenAI model
const model = new ChatOpenAI({ model: "gpt-4" });

// Automatically starts and connects to a MCP reference server
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-math"],
});

// Initialize the client
const client = new Client({
  name: "math-client",
  version: "1.0.0",
});

try {
  // Connect to the transport
  await client.connect(transport);

  // Get tools with custom configuration
  const tools = await loadMcpTools("math", client, {
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
    messages: [{ role: "user", content: "what's (3 + 5) x 12?" }],
  });
  console.log(agentResponse);
} catch (e) {
  console.error(e);
} finally {
  // Clean up connection
  await client.close();
}
```

For more detailed examples, see the [examples](./examples) directory.

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

`onRootsListChanged` was removed: roots changes are sent by clients, not observed
from servers. Pass workspace paths through tool arguments, resource URIs, or
server configuration. Modern subscription cancellation is handled by the SDK;
`onCancelled` observes notifications the SDK does not consume.

## Tool Hooks (modify args/results)

Use hooks to customize tool calls:

```ts
import { MCPAdapter } from "@langchain/mcp-adapters";

const client = new MCPAdapter({
  servers: {
    math: {
      mode: "legacy",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-math"],
    },
  },

  // Change args/headers before the tool call
  beforeToolCall: () => {
    // Overrides are merged with the original arguments by the adapter.
    // For HTTP/SSE transports, you may also add per-call headers
    return {
      args: { injected: true },
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

const tools = await client.listTools();
const t = tools.find((tool) => tool.name.includes("add"));
const out = await t?.invoke({ a: 1, b: 2 });
```

Notes:

- **beforeToolCall** can return `{ args?, headers? }`. Headers are supported for HTTP/SSE. Stdio connections do not support custom headers.
- **afterToolCall** may return `{ result }`, where `result` is a string, a 2‑tuple `[content, artifact]`, a `ToolMessage`, or a `Command`. Return nothing to keep the original result.

## Tool Configuration Options

> [!TIP]
> Tool content uses standard LangChain blocks. Use `outputHandling` to choose which outputs reach the model.

When loading MCP tools either directly through `loadMcpTools` or via `MCPAdapter`, you can configure the following options:

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
> This section is important if you are working with multimodal tools, tools that produce embedded resources, or tools that produce large outputs that you may not want to be included in LLM input context. If you are writing a new application that only works with tools that produce simple text or JSON output, leave `outputHandling` undefined to use the defaults.

MCP tools return arrays of content blocks. A content block can contain text, an image, audio, or an embedded resource. The right way to map these outputs into LangChain `ToolMessage` objects can differ based on the needs of your application, which is why the adapter provides the `outputHandling` configuration option.

Content blocks use the standard LangChain format recognized by chat model integrations. The `outputHandling` field allows you to specify whether a given type of content should be sent to the LLM, or set aside for some other part of your application to use in some future processing step (e.g. to use a dataframe from a database query in a code execution environment).

### Standardizing the Format of Tool Outputs

LangChain core introduced standard multimodal content blocks in version 0.3.48.
Earlier adapter releases offered `useStandardContentBlocks` to opt into those
formats while retaining older provider-specific shapes. This major release
removes that toggle. Model-visible images and audio use LangChain's native blocks:
`{ type: "image", data, mimeType }` and `{ type: "audio", data, mimeType }`.
A single plain text result remains a string. Embedded text retains its resource
URI in metadata; binary resources become image, audio or file blocks by MIME type.

`outputHandling` selects what reaches the model. Artifact-routed blocks retain
their MCP shape. Converted resources
and blocks with extra protocol fields retain an original copy in an
`{ type: "mcp_content", data }` artifact. Structured data and result metadata use
`mcp_structured_content` and `mcp_meta` artifacts, including `false`, `0`, `null`
and empty arrays. Result `_meta` is never appended to model-visible text.

Conversion does not fetch resource links. Use `adapter.readResource(server, uri)`
explicitly when your application needs a resource's contents.

When upgrading, remove `useStandardContentBlocks` from configuration and update
code that reads `image_url`, `source_type`, or `mime_type` to the standard fields.

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
    camera-server: {
      url: "...",
      outputHandling: {
        image: content
      },
    },
    microphone: {
      url: "...",
      outputHandling: {
        audio: content
      },
    },
  },
}
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

You can configure a global timeout for all tools by setting the `defaultToolTimeout` field in the client params. You can include a `defaultToolTimeout` field in the server config to set the timeout for all tools for that server, or globally for the entire client by setting it in the top-level config.

This timeout will be used as the default timeout for all tools unless overridden by a tool-specific timeout.

```typescript
const client = new MCPAdapter({
  servers: {
    "data-processor": {
      command: "python",
      args: ["data_server.py"],
      defaultToolTimeout: 30000, // timeout will be 30 seconds
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

// Will timeout after 30 seconds (defaultToolTimeout)
const result = await slowTool.invoke({ dataset: "huge_file.csv" });
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

// Quick timeout for fast operations
const quickResult = await fastTool.invoke(
  { query: "simple_lookup" },
  { timeout: 5000 } // 5 seconds
);

// Default timeout (60 seconds from MCP SDK) when no config provided
const normalResult = await tool.invoke({ input: "normal_processing" });
```

Timeouts can be configured using the following `RunnableConfig` fields:

| Parameter | Type        | Default   | Description                                                   |
| --------- | ----------- | --------- | ------------------------------------------------------------- |
| `timeout` | number      | 60000     | Timeout in milliseconds for the tool call                     |
| `signal`  | AbortSignal | undefined | An AbortSignal that, when asserted, will cancel the tool call |

## OAuth 2.0 Authentication

For secure MCP servers that require OAuth 2.0 authentication, you can use the `authProvider` option instead of manually managing headers. This provides automatic token refresh, error handling, and standards-compliant OAuth flows.

New in v0.4.6.

### Basic OAuth Setup

```ts
import type { OAuthClientProvider } from "@langchain/mcp-adapters";

class MyOAuthProvider implements OAuthClientProvider {
  constructor(
    private config: {
      redirectUrl: string;
      clientMetadata: OAuthClientMetadata;
    }
  ) {}

  get redirectUrl() {
    return this.config.redirectUrl;
  }
  get clientMetadata() {
    return this.config.clientMetadata;
  }

  // Implement token storage (localStorage, database, etc.)
  tokens(): OAuthTokens | undefined {
    const stored = localStorage.getItem("mcp_tokens");
    return stored ? JSON.parse(stored) : undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    localStorage.setItem("mcp_tokens", JSON.stringify(tokens));
  }

  // Implement other required methods...
  // See MCP SDK documentation for complete examples
}

const client = new MCPAdapter({
  servers: {
    "secure-server": {
      url: "https://secure-mcp-server.example.com/mcp",
      authProvider: new MyOAuthProvider({
        redirectUrl: "https://myapp.com/oauth/callback",
        clientMetadata: {
          redirect_uris: ["https://myapp.com/oauth/callback"],
          client_name: "My MCP Client",
          scope: "mcp:read mcp:write",
        },
      }),
    },
  },
});
```

### OAuth Features

The `authProvider` automatically handles:

- ✅ **Token Refresh**: Automatically refreshes expired access tokens using refresh tokens
- ✅ **401 Error Recovery**: Automatically retries requests after successful authentication
- ✅ **PKCE Security**: Uses Proof Key for Code Exchange for enhanced security
- ✅ **Standards Compliance**: Follows OAuth 2.0 and RFC 6750 specifications
- ✅ **Transport Compatibility**: Works with both StreamableHTTP and SSE transports

### OAuth vs Manual Headers

| Aspect            | OAuth Provider          | Manual Headers                    |
| ----------------- | ----------------------- | --------------------------------- |
| **Token Refresh** | ✅ Automatic            | ❌ Manual implementation required |
| **401 Handling**  | ✅ Automatic retry      | ❌ Manual error handling required |
| **Security**      | ✅ PKCE, secure flows   | ⚠️ Depends on implementation      |
| **Standards**     | ✅ RFC 6750 compliant   | ⚠️ Requires manual compliance     |
| **Complexity**    | ✅ Simple configuration | ❌ Complex implementation         |

**Recommendation**: Use `authProvider` for production OAuth servers, and `headers` only for simple token-based auth or debugging.

## Reconnection Strategies

Both transport types support automatic reconnection:

### Stdio Transport Restart

```ts
{
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
  headers: { "Authorization": "Bearer token123" },
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
import { isInteropZodError } from "@langchain/core/utils/types";
import { MCPAdapter, isToolException } from "@langchain/mcp-adapters";

let adapter: MCPAdapter | undefined;
try {
  adapter = new MCPAdapter({
    servers: {
      math: {
        mode: "legacy",
        transport: "stdio",
        command: "node",
        args: ["./math-server.js"],
      },
    },
  });
  const [tool] = await adapter.listTools();
  if (!tool) throw new Error("No tools available");
  await tool.invoke({ expression: "1 + 2" });
} catch (error) {
  if (isToolException(error)) {
    console.error("Tool execution failed:", error.message);
    if (isInteropZodError(error.cause)) {
      console.error("Validation details:", error.cause);
    }
  } else if (isInteropZodError(error)) {
    console.error("Configuration error:", error);
  } else {
    console.error("Connection or other error:", error);
  }
} finally {
  await adapter?.close();
}
```

Configuration validation throws Zod4 errors directly. Tool execution wraps
validation failures in `ToolException`, preserving the original Zod error as
`cause`. SDK argument-validation issues become Zod4 custom issues with their
messages and paths. Server and transport failures are not Zod validation errors.

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
- Failed servers are removed from the connection list and won't be retried
- If no servers successfully connect, a warning is logged but no error is thrown

```ts
const client = new MCPAdapter({
  servers: {
    "working-server": {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-math"],
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

## License

MIT

## Acknowledgements

Big thanks to [@vrknetha](https://github.com/vrknetha), [@knacklabs](https://www.knacklabs.ai) for the initial implementation!

## Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) for more information.

### Discovery freshness

`getTools()` consults the SDK cache on each discovery. The SDK owns cache hints,
TTL, and pagination; the adapter reuses adapted tools while the cached descriptors
remain the same. Tools already returned to a running agent are not mutated.

```typescript
const tools = await adapter.getTools([], { cacheMode: "refresh" });
```

Use `"use"` (default) to honor the SDK cache, `"refresh"` to fetch and update it,
or `"bypass"` to fetch without reading or updating it. Keep each OAuth provider
bound to one authorization identity; close and recreate the adapter when changing
accounts, rather than changing the identity behind an existing provider.

## Server tool schemas

Tools expose the server's JSON Schema unchanged, including references, unions,
and conditional constraints. The adapter does not simplify schemas for a model
provider. Check the chosen provider's supported schema subset before binding
tools; the Anthropic integration omits tools with root-level `allOf`, `anyOf`, or
`oneOf`.

Prefer a compatible schema on the server. If the model needs a different schema,
set the returned tool's `schema` explicitly before binding it. Core uses that
schema for initial input validation; the adapter still validates post-hook
arguments against an independent copy of the original server schema.

`ToolException` requires `@langchain/core ^1.2.6`. Use
`ToolException.isInstance(error)` or `isToolException(error)` to identify it;
name-only objects are not treated as adapter errors.
