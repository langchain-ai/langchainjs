# LangChain.js MCP Adapters

This package provides adapters for using [Model Context Protocol (MCP)](https://github.com/model-context-protocol/model-context-protocol) tools with LangChain.js.

## Installation

```bash
npm install langchainjs-mcp-adapters
```

## Usage

### Connecting to an MCP Server

You can connect to an MCP server using either stdio or SSE transport:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

// Create a client
const client = new MultiServerMCPClient();

// Connect to a server using stdio
await client.connectToServerViaStdio(
  'math-server', // A name to identify this server
  'python', // Command to run
  ['./math_server.py'] // Arguments for the command
);

// Connect to a server using SSE
await client.connectToServerViaSSE(
  'weather-server', // A name to identify this server
  'http://localhost:8000/sse' // URL of the SSE server
);

// Get all tools from all connected servers
const tools = client.getTools();

// Use the tools
const result = await tools[0].invoke({ param1: 'value1', param2: 'value2' });

// Close the client when done
await client.close();
```

### Initializing Multiple Connections

You can also initialize multiple connections at once:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

const client = new MultiServerMCPClient({
  'math-server': {
    transport: 'stdio',
    command: 'python',
    args: ['./math_server.py'],
  },
  'weather-server': {
    transport: 'sse',
    url: 'http://localhost:8000/sse',
  },
});

// Initialize all connections
await client.initialize();

// Get all tools
const tools = client.getTools();

// Close all connections when done
await client.close();
```

### Using Configuration File

You can define your MCP server configurations in a JSON file (`mcp.json`) and load them:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

// Create a client from the config file
const client = MultiServerMCPClient.fromConfigFile();
// Or specify a custom path: MultiServerMCPClient.fromConfigFile("./config/mcp.json");

// Initialize all connections
await client.initialize();

// Get all tools
const tools = client.getTools();

// Close all connections when done
await client.close();
```

Example `mcp.json` file:

```json
{
  "servers": {
    "math": {
      "transport": "stdio",
      "command": "python",
      "args": ["./examples/math_server.py"]
    },
    "weather": {
      "transport": "sse",
      "url": "http://localhost:8000/sse"
    }
  }
}
```

You can also omit the `transport` field for stdio servers, as it's the default transport:

```json
{
  "servers": {
    "math": {
      "command": "python",
      "args": ["./examples/math_server.py"]
    },
    "weather": {
      "transport": "sse",
      "url": "http://localhost:8000/sse"
    }
  }
}
```

The client will attempt to connect to all servers defined in the configuration file. If a server is not available, it will log an error and continue with the available servers. If no servers are available, it will throw an error.

```typescript
// Error handling when initializing connections
try {
  const client = MultiServerMCPClient.fromConfigFile();
  await client.initialize();
  // Use the client...
} catch (error) {
  console.error('Failed to connect to any servers:', error.message);
}
```

### Using with LangChain Agents

You can use MCP tools with LangChain agents:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Create a client and connect to servers
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);

// Get tools
const tools = client.getTools();

// Create an agent
const model = new ChatOpenAI({ temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant that can use tools to solve problems.'],
  ['human', '{input}'],
]);

const agent = createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

// Run the agent
const result = await agentExecutor.invoke({
  input: 'What is 5 + 3?',
});

console.log(result.output);

// Close the client when done
await client.close();
```

## Example MCP Servers

### Math Server (stdio transport)

Here's an example of a simple MCP server in Python using stdio transport:

```python
from mcp.server.fastmcp import FastMCP

# Create a server
mcp = FastMCP(name="Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers and return the result."""
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two integers and return the result."""
    return a * b

# Run the server with stdio transport
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Weather Server (SSE transport)

Here's an example of an MCP server using SSE transport:

```python
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
        "tokyo": "25 degrees Celsius",
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

## Running the Examples

The package includes several example files that demonstrate how to use MCP adapters:

1. `math_example.ts` - Basic example using a math server with stdio transport
2. `sse_example.ts` - Example using a weather server with SSE transport
3. `multi_sse_example.ts` - Example connecting to multiple servers with different transport types
4. `config_example.ts` - Example using server configurations from an `mcp.json` file

To run the examples:

```bash
# Start the weather server with SSE transport
python examples/weather_server.py

# In another terminal, run the SSE example
node --loader ts-node/esm examples/sse_example.ts

# Or run the multi-server example
node --loader ts-node/esm examples/multi_sse_example.ts

# Or run the config-based example (requires mcp.json in the project root)
node --loader ts-node/esm examples/config_example.ts
```

## Development

### GitHub Actions Workflows

This project uses GitHub Actions for continuous integration and deployment:

#### PR Validation

The PR validation workflow runs automatically on all pull requests to the `main` branch. It performs:

- Code linting with ESLint
- Type checking with TypeScript
- Unit tests with Jest
- Format checking with Prettier

#### Continuous Integration

The CI workflow runs on the `main` branch after merges and:

- Runs linting and tests
- Builds the package
- Generates and uploads test coverage reports

#### Publishing to npm

The package can be published to npm in two ways:

1. **Automatic publishing on GitHub Release**:

   - Create a new release in GitHub
   - The workflow will automatically publish the package with the release version

2. **Manual publishing**:
   - Go to the "Actions" tab in GitHub
   - Select the "Publish to npm" workflow
   - Click "Run workflow"
   - Choose the version bump type (patch, minor, major) or specify a version

### Setting up npm publishing

To enable npm publishing, you need to:

1. Create an npm access token with publish permissions
2. Add the token as a GitHub repository secret named `NPM_TOKEN`

### Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

### Changelog

For a detailed list of changes between versions, see the [CHANGELOG.md](CHANGELOG.md) file.

## License

MIT
