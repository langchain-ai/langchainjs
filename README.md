# LangChain.js MCP Adapters

[![npm version](https://img.shields.io/npm/v/@langchain/mcp-adapters.svg)](https://www.npmjs.com/package/@langchain/mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This library provides a lightweight wrapper that makes [Anthropic Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) tools compatible with [LangChain.js](https://github.com/langchain-ai/langchainjs) and [LangGraph.js](https://github.com/langchain-ai/langgraphjs).

## Features

- 🔌 **Transport Options**

  - Connect to MCP servers via stdio (local) or SSE (remote)
  - Support for custom headers in SSE connections for authentication
  - Configurable reconnection strategies for both transport types

- 🔄 **Multi-Server Management**

  - Connect to multiple MCP servers simultaneously
  - Auto-organize tools by server or access them as a flattened collection
  - Convenient configuration via JSON file

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

### Optional Dependencies

For SSE connections with custom headers in Node.js:

```bash
npm install eventsource
```

For enhanced SSE header support:

```bash
npm install extended-eventsource
```

# Example: Manage the MCP Client yourself

This example shows how you can manage your own MCP client and use it to get tools that you can pass to a LangGraph prebuilt ReAcT agent.

```bash
npm install @langchain/mcp-adapters @langchain/langgraph @langchain/core @langchain/openai

export OPENAI_API_KEY=<your_api_key>
```

## Client

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
    // Optional additional prefix for tool names (optional, default: "")
    additionalToolNamePrefix: "",
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

# Example: Connect to one or more servers via config

The library also allows you to connect to multiple MCP servers and load tools from them:

## Client

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

    // SSE transport example with reconnection configuration
    weather: {
      transport: "sse",
      url: "https://example.com/mcp-weather",
      headers: {
        Authorization: "Bearer token123",
      },
      useNodeEventSource: true,
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

For more detailed examples, see the [examples](./examples) directory.

## Tool Configuration Options

When loading MCP tools either directly through `loadMcpTools` or via `MultiServerMCPClient`, you can configure the following options:

| Option                         | Type    | Default | Description                                                                          |
| ------------------------------ | ------- | ------- | ------------------------------------------------------------------------------------ |
| `throwOnLoadError`             | boolean | `true`  | Whether to throw an error if a tool fails to load                                    |
| `prefixToolNameWithServerName` | boolean | `false` | If true, prefixes all tool names with the server name (e.g., `serverName__toolName`) |
| `additionalToolNamePrefix`     | string  | `""`    | Additional prefix to add to tool names (e.g., `prefix__serverName__toolName`)        |

## Response Handling

MCP tools return results in the `content_and_artifact` format which can include:

- **Text content**: Plain text responses
- **Image content**: Base64-encoded images with MIME type
- **Embedded resources**: Files, structured data, or other resources

Example for handling different content types:

```ts
const tool = tools.find((t) => t.name === "mcp__math__calculate");
const result = await tool.invoke({ expression: "(3 + 5) * 12" });

// Result format: [content, artifacts]
// - content: string | MessageContentComplex[]
// - artifacts: EmbeddedResource[]

const [textContent, artifacts] = result;

// Handle text content
if (typeof textContent === "string") {
  console.log("Result:", textContent);
} else {
  // Handle complex content (text + images)
  textContent.forEach((item) => {
    if (item.type === "text") {
      console.log("Text:", item.text);
    } else if (item.type === "image_url") {
      console.log("Image URL:", item.image_url.url);
    }
  });
}

// Handle artifacts if needed
if (artifacts.length > 0) {
  console.log("Received artifacts:", artifacts);
}
```

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
  useNodeEventSource: true,
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
    math: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-math"],
    },
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

## Browser Environments

When using in browsers:

- Native EventSource API doesn't support custom headers
- Consider using a proxy or pass authentication via query parameters
- May require CORS configuration on the server side

## Troubleshooting

### Common Issues

1. **Connection Failures**:

   - Verify the MCP server is running
   - Check command paths and network connectivity

2. **Tool Execution Errors**:

   - Examine server logs for error messages
   - Ensure input parameters match the expected schema

3. **Headers Not Applied**:
   - Install the recommended `extended-eventsource` package
   - Set `useNodeEventSource: true` in SSE connections

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

Big thanks to [@vrknetha](https://github.com/vrknetha), [@cawstudios](https://caw.tech) for the initial implementation!

## Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) for more information.
