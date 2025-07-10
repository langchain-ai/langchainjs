# LangChain.js MCP Adapters

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

# Example: Connect to one or more servers via `MultiServerMCPClient`

The library allows you to connect to one or more MCP servers and load tools from them, without needing to manage your own MCP client instances.

```ts
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Create client and connect to server
const client = new MultiServerMCPClient({
  // Global tool configuration options
  // Whether to throw on errors if a tool fails to load (optional, default: true)
  throwOnLoadError: true,
  // Whether to prefix tool names with the server name (optional, default: true)
  prefixToolNameWithServerName: true,
  // Optional additional prefix for tool names (optional, default: "mcp")
  additionalToolNamePrefix: "mcp",
  
  // Use standardized content block format in tool outputs
  useStandardContentBlocks: true,

  // Server configuration
  mcpServers: {
    // adds a STDIO connection to a server named "math"
    math: {
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
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    },

    // Sreamable HTTP transport example, with auth headers and automatic SSE fallback disabled (defaults to enabled)
    weather: {
      url: "https://example.com/weather/mcp",
      headers: {
        Authorization: "Bearer token123",
      }
      automaticSSEFallback: false
    },

    // OAuth 2.0 authentication (recommended for secure servers)
    "oauth-protected-server": {
      url: "https://protected.example.com/mcp",
      authProvider: new MyOAuthProvider({
        // Your OAuth provider implementation
        redirectUrl: "https://myapp.com/oauth/callback",
        clientMetadata: {
          redirect_uris: ["https://myapp.com/oauth/callback"],
          client_name: "My MCP Client",
          scope: "mcp:read mcp:write"
        }
      }),
      // Can still include custom headers for non-auth purposes
      headers: {
        "User-Agent": "My-MCP-Client/1.0"
      }
    },

    // how to force SSE, for old servers that are known to only support SSE (streamable HTTP falls back automatically if unsure)
    github: {
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

const tools = await client.getTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
});

// Create the React agent
const agent = createReactAgent({
  llm: model,
  tools,
});

// Run the agent
try {
  const mathResponse = await agent.invoke({
    messages: [{ role: "user", content: "what's (3 + 5) x 12?" }],
  });
  console.log(mathResponse);
} catch (error) {
  console.error("Error during agent execution:", error);
  // Tools throw ToolException for tool-specific errors
  if (error.name === "ToolException") {
    console.error("Tool execution failed:", error.message);
  }
}

await client.close();
```

# Example: Manage the MCP Client yourself

This example shows how you can manage your own MCP client and use it to get LangChain tools. These tools can be used anywhere LangChain tools are used, including with LangGraph prebuilt agents, as shown below.

The example below requires some prerequisites:

```bash
npm install @langchain/mcp-adapters @langchain/langgraph @langchain/core @langchain/openai

export OPENAI_API_KEY=<your_api_key>
```


```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadMcpTools } from "@langchain/mcp-adapters";

// Initialize the ChatOpenAI model
const model = new ChatOpenAI({ modelName: "gpt-4" });

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
    // Optional additional prefix for tool names (optional, default: "mcp")
    additionalToolNamePrefix: "mcp",
    // Use standardized content block format in tool outputs
    useStandardContentBlocks: true,
  });

  // Create and run the agent
  const agent = createReactAgent({ llm: model, tools });
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

## Tool Configuration Options

> [!TIP]
> The `useStandardContentBlocks` defaults to `false` for backward compatibility, however we recommend setting it to `true` for new applications, as this will likely become the default in a future release.

When loading MCP tools either directly through `loadMcpTools` or via `MultiServerMCPClient`, you can configure the following options:

| Option                         | Type    | Default | Description                                                                           |
| ------------------------------ | ------- | ------- | ------------------------------------------------------------------------------------- |
| `throwOnLoadError`             | `boolean` | `true`  | Whether to throw an error if a tool fails to load                                     |
| `prefixToolNameWithServerName` | `boolean` | `true`  | If true, prefixes all tool names with the server name (e.g., `serverName__toolName`)  |
| `additionalToolNamePrefix`     | `string`  | `"mcp"`   | Additional prefix to add to tool names (e.g., `prefix__serverName__toolName`)         |
| `useStandardContentBlocks`     | `boolean` | `false` | See [Tool Output Mapping](#tool-output-mapping); set true for new applications        |
| `outputHandling`               | `"content"`, `"artifact"`, or `object` | `resource` -> `"artifact"`, all others -> `"content"` | See [Tool Output Mapping](#tool-output-mapping) |

## Tool Output Mapping

> [!TIP]
> This section is important if you are working with multimodal tools, tools that produce embedded resources, or tools that produce large outputs that you may not want to be included in LLM input context. If you are writing a new application that only works with tools that produce simple text or JSON output, we recommend setting `useStandardContentBlocks` to `true` and leaving `outputHandling` undefined (will use defaults).

MCP tools return arrays of content blocks. A content block can contain text, an image, audio, or an embedded resource. The right way to map these outputs into LangChain `ToolMessage` objects can differ based on the needs of your application, which is why we introduced the `useStandardContentBlocks` and `outputHandling` configuration options.

The `useStandardContentBlocks` field determines how individual MCP content blocks are transformed into a structure recognized by LangChain ChatModel providers (e.g. `ChatOpenAI`, `ChatAnthropic`, etc). The `outputHandling` field allows you to specify whether a given type of content should be sent to the LLM, or set aside for some other part of your application to use in some future processing step (e.g. to use a dataframe from a database query in a code execution environment).

### Standardizing the Format of Tool Outputs

In `@langchain/core` version 0.3.48 we created a new set of content block types that offer a standardized structure for multimodal inputs. As you might guess from the name, the `useStandardContentBlocks` setting determines whether `@langchain/mcp-adapters` converts tool outputs to this format. For backward compatibility with older versions of `@langchain/mcp-adapters`, it also determines whether tool message artifacts are converted. See the conversion rules below for more info.

> [!IMPORTANT]
> `ToolMessage.content` and `ToolMessage.artifact` will always be arrays of content block objects as described by the rules below, except in one special case. When the `outputHandling` option routes `text` output to the `ToolMessage.content` field and the only content block produced by a tool call is a `text` block, `ToolMessage.content` will be a `string` containing the text content produced by the tool.

**When `useStandardContentBlocks` is `true` (recommended for new applications):**

- **Text**: Returned as [`StandardTextBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardTextBlock.html) objects.
- **Images**: Returned as base64 [`StandardImageBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardImageBlock.html) objects.
- **Audio**: Returned as base64 [`StandardAudioBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardAudioBlock.html) objects.
- **Embedded Resources**: Returned as [`StandardFileBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardFileBlock.html), with a `source_type` of `text` or `base64` depending on whether the resource was binary or text. URI resources are fetched eagerly from the server and the results of the fetch are returned following these same rules. We treat all embedded resource URIs as resolvable by the server, and we do not attempt to fetch external URIs.


**When `useStandardContentBlocks` is `false` (default for backward compatibility):**

- Tool outputs routed to `ToolMessage.artifact` (controlled by the `outputHandling` option):
  - **Embedded Resources**: Embedded resources containing only a URI are fetched eagerly from the server and the results of the fetch operation are stored in the artifact array without transformation. Otherwise embedded resources are stored in the `artifact` array in their original MCP content block structure without modification.
  - **All other content types**: Stored in the `artifact` array in their original MCP content block structure without modification.
- Tool outputs routed to the `ToolMessage.content` array (controlled by the `outputHandling` option):
  - **Text**: Returned as [`MessageContentText`](https://v03.api.js.langchain.com/types/_langchain_core.messages.MessageContentText.html) objects, unless it is the only content block in the output, in which case it's assigned directly to `ToolMessage.content` as a `string`.
  - **Images**: Returned as [`MessageContentImageUrl`](https://v03.api.js.langchain.com/types/_langchain_core.messages.MessageContentImageUrl.html) objects with base64 data URLs (`data:image/png;base64,<data>`)
  - **Audio**: Returned as [`StandardAudioBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardAudioBlock.html) objects.
  - **Embedded Resources**: Returned as [`StandardFileBlock`](https://v03.api.js.langchain.com/types/_langchain_core.messages.StandardFileBlock.html), with a `source_type` of `text` or `base64` depending on whether the resource was binary or text. URI resources are fetched eagerly from the server and the results of the fetch are returned following these same rules. We treat all embedded resource URIs as resolvable by the server, and we do not attempt to fetch external URIs.
  
### Determining Which Tool Outputs will be Visible to the LLM

The `outputHandling` option allows you to determine which tool output types are assigned to `ToolMessage.content`, and which are assigned to `ToolMessage.artifact`. Data in [`ToolMessage.content`](https://v03.api.js.langchain.com/classes/_langchain_core.messages_tool.ToolMessage.html#content) is used as input context when the LLM is invoked, while [`ToolMessage.artifact`](https://v03.api.js.langchain.com/classes/_langchain_core.messages_tool.ToolMessage.html#artifact) is not.

**By default** `@langchain/mcp-adapters` maps MCP `resource` content blocks to `ToolMessage.artifact`, and maps all other MCP content block types to `ToolMessage.content`. The value of [`useStandardContentBlocks`](#standardizing-the-format-of-tool-outputs) determines how the structure of each content block is transformed during this process.

> [!TIP]
> Examples where `ToolMessage.artifact` can be useful include cases when you need to send multimodal tool outputs via `HumanMessage` or `SystemMessage` because the LLM provider API doesn't accept multimodal tool outputs, or cases where one tool might produce a large output to be indirectly manipulated by some other tool (e.g. a query tool that loads dataframes into a Python code execution environment).

The `outputHandling` option can be assigned to `"content"`, `"artifact"`, or an object that maps MCP content block types to either `content` or `artifact`.

When working with `MultiServerMCPClient`, the `outputHandling` field can be assigned to the top-level config object and/or to individual server entries in `mcpServers`. Entries in `mcpServers` override those in the top-level config, and entries in the top-level config override the defaults.

For example, consider the following configuration:

```typescript
const clientConfig = {
  useStandardContentBlocks: true,
  outputHandling: {
    image: "artifact",
    audio: "artifact",
  },
  mcpServers: {
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

MCP tools support timeout configuration through LangChain's standard `RunnableConfig` interface. This allows you to set custom timeouts on a per-tool-call basis:

```typescript
const client = new MultiServerMCPClient({
  mcpServers: {
    'data-processor': {
      command: 'python',
      args: ['data_server.py']
    },
  },
  useStandardContentBlocks: true,
});

const tools = await client.getTools();
const slowTool = tools.find(t => t.name.includes('process_large_dataset'));

// You can use withConfig to set tool-specific timeouts before handing
// the tool off to a LangGraph ToolNode or some other part of your
// application
const slowToolWithTimeout = slowTool.withConfig({ timeout: 300000 }); // 5 min timeout

// This invocation will respect the 5 minute timeout
const result = await slowToolWithTimeout.invoke(
  { dataset: 'huge_file.csv' },
);

// or you can invoke directly without withConfig
const directResult = await slowTool.invoke(
  { dataset: 'huge_file.csv' },
  { timeout: 300000 }
);

// Quick timeout for fast operations
const quickResult = await fastTool.invoke(
  { query: 'simple_lookup' },
  { timeout: 5000 } // 5 seconds
);

// Default timeout (60 seconds from MCP SDK) when no config provided
const normalResult = await tool.invoke({ input: 'normal_processing' });
```

Timeouts can be configured using the following `RunnableConfig` fields:

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `timeout` | number | 60000 | Timeout in milliseconds for the tool call |
| `signal`  | AbortSignal | undefined | An AbortSignal that, when asserted, will cancel the tool call |

## OAuth 2.0 Authentication

For secure MCP servers that require OAuth 2.0 authentication, you can use the `authProvider` option instead of manually managing headers. This provides automatic token refresh, error handling, and standards-compliant OAuth flows.

New in v0.4.6.

### Basic OAuth Setup

```ts
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";

class MyOAuthProvider implements OAuthClientProvider {
  constructor(private config: {
    redirectUrl: string;
    clientMetadata: OAuthClientMetadata;
  }) {}

  get redirectUrl() { return this.config.redirectUrl; }
  get clientMetadata() { return this.config.clientMetadata; }

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

const client = new MultiServerMCPClient({
  mcpServers: {
    "secure-server": {
      url: "https://secure-mcp-server.example.com/mcp",
      authProvider: new MyOAuthProvider({
        redirectUrl: "https://myapp.com/oauth/callback",
        clientMetadata: {
          redirect_uris: ["https://myapp.com/oauth/callback"],
          client_name: "My MCP Client",
          scope: "mcp:read mcp:write"
        }
      })
    },
  },
  useStandardContentBlocks: true,
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

| Aspect | OAuth Provider | Manual Headers |
|--------|----------------|----------------|
| **Token Refresh** | ✅ Automatic | ❌ Manual implementation required |
| **401 Handling** | ✅ Automatic retry | ❌ Manual error handling required |
| **Security** | ✅ PKCE, secure flows | ⚠️ Depends on implementation |
| **Standards** | ✅ RFC 6750 compliant | ⚠️ Requires manual compliance |
| **Complexity** | ✅ Simple configuration | ❌ Complex implementation |

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
try {
  const client = new MultiServerMCPClient({
    mcpServers: {
      math: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-math"],
      },
    },
    useStandardContentBlocks: true,
  });

  const tools = await client.getTools();
  const result = await tools[0].invoke({ expression: "1 + 2" });
} catch (error) {
  if (error.name === "MCPClientError") {
    // Handle connection issues
    console.error(`Connection error (${error.serverName}):`, error.message);
  } else if (error.name === "ToolException") {
    // Handle tool execution errors
    console.error("Tool execution failed:", error.message);
  } else if (error.name === "ZodError") {
    // Handle configuration validation errors
    console.error("Configuration error:", error.issues);
    // Zod errors contain detailed information about what went wrong
    error.issues.forEach((issue) => {
      console.error(`- Path: ${issue.path.join(".")}, Error: ${issue.message}`);
    });
  } else {
    // Handle other errors
    console.error("Unexpected error:", error);
  }
}
```

### Common Zod Validation Errors

The library uses Zod for validating configuration. Here are some common validation errors:

- **Missing required parameters**: For example, omitting `command` for stdio transport or `url` for SSE transport
- **Invalid parameter types**: For example, providing a number where a string is expected
- **Invalid connection configuration**: For example, using an invalid URL format for SSE transport

Example Zod error for an invalid SSE URL:

```json
{
  "issues": [
    {
      "code": "invalid_string",
      "validation": "url",
      "path": ["mcpServers", "weather", "url"],
      "message": "Invalid url"
    }
  ],
  "name": "ZodError"
}
```

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
