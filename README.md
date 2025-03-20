# LangChain.js MCP Adapters

[![npm version](https://img.shields.io/npm/v/@langchain/mcp-adapters.svg)](https://www.npmjs.com/package/@langchain/mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This library provides a lightweight wrapper that makes[Anthropic Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) tools compatible with [LangChain.js](https://github.com/langchain-ai/langchainjs) and [LangGraph.js](https://github.com/langchain-ai/langgraphjs).

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

- 🛠️ **Development Features**
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

## Prerequisites

- Node.js >= 18
- For stdio transport: Python MCP servers require Python 3.8+
- For SSE transport: A running MCP server with SSE endpoint
- For SSE with headers in Node.js: The `eventsource` package

# Quickstart

Here is a simple example of using the MCP tools with a LangGraph agent.

```bash
npm install @langchain/mcp-adapters @langchain/langgraph @langchain/core @langchain/openai

export OPENAI_API_KEY=<your_api_key>
```

### Server

First, let's create an MCP server that can add and multiply numbers.

```python
# math_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two numbers"""
    return a * b

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Client

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { loadMcpTools } from '@langchain/mcp-adapters';

// Initialize the ChatOpenAI model
const model = new ChatOpenAI({ modelName: 'gpt-4' });

// Create transport for stdio connection
const transport = new StdioClientTransport({
  command: 'python',
  args: ['math_server.py'],
});

// Initialize the client
const client = new Client({
  name: 'math-client',
  version: '1.0.0',
});

try {
  // Connect to the transport
  await client.connect(transport);

  // Get tools
  const tools = await loadMcpTools("math", client);

  // Create and run the agent
  const agent = createReactAgent({ llm: model, tools });
  const agentResponse = await agent.invoke({
    messages: [{ role: 'user', content: "what's (3 + 5) x 12?" }],
  });
  console.log(agentResponse);
} catch (e) {
  console.error(e);
} finally {
  // Clean up connection
  await client.close();
}
```

## Multiple MCP Servers

The library also allows you to connect to multiple MCP servers and load tools from them:

### Server

```python
# math_server.py
...

# weather_server.py
from mcp.server.fastmcp import FastMCP

# Create a server
mcp = FastMCP(name="Weather")

@mcp.tool()
def get_temperature(city: str) -> str:
    """Get the current temperature for a city."""
    # Mock implementation
    temperatures = {
        "new york": "72°F",
        "london": "65°F",
        "tokyo": "25°C",
    }

    city_lower = city.lower()
    if city_lower in temperatures:
        return f"The current temperature in {city} is {temperatures[city_lower]}."
    else:
        return "Temperature data not available for this city"

# Run the server with SSE transport
if __name__ == "__main__":
    mcp.run(transport="sse")
```

### Client

```ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

// Create client and connect to server
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['math_server.py']);
await client.connectToServerViaSSE('weather-server', 'http://localhost:8000/sse');
const tools = client.getTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
});

// Create the React agent
const agent = createReactAgent({
  llm: model,
  tools,
});

// Run the agent
const mathResponse = await agent.invoke({
  messages: [{ role: 'user', content: "what's (3 + 5) x 12?" }],
});
const weatherResponse = await agent.invoke({
  messages: [{ role: 'user', content: 'what is the weather in nyc?' }],
});

await client.close();
```

Below are more detailed examples of how to configure `MultiServerMCPClient`.

### Basic Connection

```typescript
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

// Create a client
const client = new MultiServerMCPClient();

// Connect to a local server via stdio
await client.connectToServerViaStdio(
  'math-server', // Server name
  'python', // Command to run
  ['./math_server.py'] // Command arguments
);

// Connect to a remote server via SSE
await client.connectToServerViaSSE(
  'weather-server', // Server name
  'http://localhost:8000/sse' // SSE endpoint URL
);

// Get all tools from all servers as a flattened array
const tools = client.getTools();

// Get tools from specific servers
const mathTools = client.getTools(['math-server']);

// Get tools grouped by server name
const toolsByServer = client.getToolsByServer();

// Close all connections when done
await client.close();
```

> [!NOTE]
> For stdio connections, the `transport` field is optional. If not specified, it defaults to 'stdio'.

### With Authentication Headers

```typescript
// Connect to a server with authentication
await client.connectToServerViaSSE(
  'auth-server',
  'https://api.example.com/mcp/sse',
  {
    Authorization: 'Bearer token',
    'X-API-Key': 'your-api-key',
  },
  true // Use Node.js EventSource for header support
);
```

### Configuration via JSON

Define your server connections in a JSON file:

```json
{
  "servers": {
    "math": {
      "command": "python",
      "args": ["./math_server.py"]
    },
    "weather": {
      "transport": "sse",
      "url": "http://localhost:8000/sse",
      "headers": {
        "Authorization": "Bearer token"
      },
      "useNodeEventSource": true
    }
  }
}
```

Then load it in your code:

```typescript
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

// Load from default location (./mcp.json)
const client = MultiServerMCPClient.fromConfigFile();
// Or specify a custom path
// const client = MultiServerMCPClient.fromConfigFile('./config/mcp.json');

await client.initializeConnections();
const tools = client.getTools();
```

## Enhanced Configuration Management

LangChainJS-MCP-Adapters provides flexible and powerful configuration management capabilities:

### Automatic Default Configuration

The client automatically looks for and loads a `mcp.json` file from the current working directory if no explicit configuration is provided:

```typescript
// This will automatically load from ./mcp.json if it exists
const client = new MultiServerMCPClient();
await client.initializeConnections();
```

### Configuration Loading Options

There are multiple ways to load configurations:

```typescript
// Method 1: Automatic default loading
const client1 = new MultiServerMCPClient(); // Automatically checks for mcp.json

// Method 2: From specified config file
const client2 = MultiServerMCPClient.fromConfigFile('./config/custom-mcp.json');
```

### Combining Multiple Configuration Sources

You can combine configurations from multiple sources - they will be merged rather than replaced:

```typescript
// Start with default configuration or empty if no mcp.json exists
const client = new MultiServerMCPClient();

// Add another configuration file
client.addConfigFromFile('./team1-servers.json');

// Add yet another configuration file
client.addConfigFromFile('./team2-servers.json');

// Add configurations directly in code
client.addConnections({
  'custom-server': {
    transport: 'stdio',
    command: 'python',
    args: ['./special_server.py'],
  },
});

// Initialize all connections from all sources
await client.initializeConnections();
```

### Configuration Processing Order

Configurations are processed in the order they are added:

1. Constructor argument or automatic `mcp.json` (if present)
2. Each `addConfigFromFile()` call in sequence
3. Each `addConnections()` call in sequence

If the same server name appears in multiple configurations, **the later configuration takes precedence**, allowing for overriding settings.

### Direct Connection Methods

For simple use cases, you can bypass configuration files entirely and connect to servers directly using the provided connection methods:

```typescript
const client = new MultiServerMCPClient();

// Add a stdio connection
await client.connectToServerViaStdio(
  'math-server',
  'python',
  ['./math_server.py'],
  // Optional environment variables
  { PYTHONPATH: './lib' },
  // Optional restart configuration
  { enabled: true, maxAttempts: 3, delayMs: 2000 }
);

// Add an SSE connection
await client.connectToServerViaSSE(
  'remote-server',
  'https://api.example.com/mcp/sse',
  // Optional headers
  { Authorization: 'Bearer token' },
  // Optional Node.js EventSource flag
  true,
  // Optional reconnection configuration
  { enabled: true, maxAttempts: 5, delayMs: 1000 }
);
```

### Environment Variable Substitution

Configuration files support environment variable substitution using `${ENV_VAR}` syntax in both string values and environment variable objects:

```json
{
  "servers": {
    "api-server": {
      "transport": "sse",
      "url": "https://${API_DOMAIN}/sse",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    },
    "local-server": {
      "transport": "stdio",
      "command": "python",
      "args": ["./server.py"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "DEBUG_LEVEL": "info"
      }
    }
  }
}
```

### Configuration File Structure

Below is the complete schema for the configuration file:

```json
{
  "servers": {
    "server-name": {
      // For stdio transport (transport field is optional for stdio)
      "transport": "stdio", // Optional for stdio, defaults to "stdio" if command and args are present
      "command": "python",
      "args": ["./server.py"],
      "env": {
        "ENV_VAR": "value"
      },
      "encoding": "utf-8",
      "encodingErrorHandler": "strict",
      "restart": {
        "enabled": true,
        "maxAttempts": 3,
        "delayMs": 1000
      },

      // For SSE transport (transport field is required)
      "transport": "sse",
      "url": "http://localhost:8000/sse",
      "headers": {
        "Authorization": "Bearer token"
      },
      "useNodeEventSource": true,
      "reconnect": {
        "enabled": true,
        "maxAttempts": 3,
        "delayMs": 1000
      }
    }
  }
}
```

> [!NOTE]
> For stdio connections, the `transport` field is optional. If not specified, it defaults to 'stdio' when `command` and `args` are present.

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
