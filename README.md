# LangChain.js MCP Adapters

[![npm version](https://img.shields.io/npm/v/langchainjs-mcp-adapters.svg)](https://www.npmjs.com/package/langchainjs-mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A library for seamlessly integrating [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) tools with LangChain.js. This adapter enables LangChain agents to leverage MCP's standardized tool protocol across different model providers and agent frameworks.

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

  - Compatible with all LangChain agent frameworks
  - Optimized for OpenAI, Anthropic, and Google models
  - Tools ready for use with LangGraph workflows

- 🛠️ **Development Features**
  - Comprehensive logging system
  - Flexible configuration options
  - Robust error handling

## Installation

```bash
npm install langchainjs-mcp-adapters
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

## Usage

### Basic Connection

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

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
      "transport": "stdio",
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
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

// Load from default location (./mcp.json)
const client = MultiServerMCPClient.fromConfigFile();
// Or specify a custom path
// const client = MultiServerMCPClient.fromConfigFile('./config/mcp.json');

await client.initializeConnections();
const tools = client.getTools();
```

## Integration with LangChain Agents

### OpenAI Functions Agent

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Create client and connect to server
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);
const tools = client.getTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
});

// Create a prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant that can use tools to solve problems.'],
  ['human', '{input}'],
  ['ai', '{agent_scratchpad}'],
]);

// Create the agent
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt,
});

// Create the executor
const executor = new AgentExecutor({
  agent,
  tools,
});

// Run the agent
const result = await executor.invoke({
  input: "What's 5 + 3?",
});
```

### React Agent

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Create client and connect to server
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);
const tools = client.getTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
});

// Create a prompt template with specific format for React
const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a helpful assistant that solves problems step-by-step.
  
You have access to the following tools:
{tools}

Available tool names: {tool_names}

Use this format:
Question: The input question
Thought: Your reasoning
Action: The tool name to use
Action Input: The input to the tool as JSON
Observation: The result from the tool
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I know the answer now
Final Answer: The final answer to the question`,
  ],
  ['human', '{input}'],
  ['ai', '{agent_scratchpad}'],
]);

// Create the React agent
const agent = await createReactAgent({
  llm: model,
  tools,
  prompt,
});

// Create the executor
const executor = new AgentExecutor({
  agent,
  tools,
});

// Run the agent
const result = await executor.invoke({
  input: "What's 5 + 3?",
});
```

### LangGraph Integration

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { MessagesAnnotation } from '@langchain/langgraph';

// Create client and get tools
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);
const tools = client.getTools();

// Create model and tool nodes
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
}).bindTools(tools);

// Create the tool node
const toolNode = new ToolNode(tools);

// Create the LLM node
const llmNode = async state => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
};

// Create a graph
const workflow = new StateGraph({
  channels: MessagesAnnotation,
});

// Add nodes to the graph
workflow.addNode('llm', llmNode);
workflow.addNode('tools', toolNode);

// Define edges
workflow.addEdge('llm', 'tools');
workflow.addEdge('tools', 'llm');

// Add conditional edge to end the conversation
workflow.addConditionalEdges('tools', state => {
  const lastMsg = state.messages[state.messages.length - 1];
  // Check if the last message doesn't contain tool calls
  return lastMsg._getType() === 'ai' && (!lastMsg.tool_calls || lastMsg.tool_calls.length === 0)
    ? END
    : 'llm';
});

// Set the entry point
workflow.setEntryPoint('llm');

// Compile the graph
const app = workflow.compile();

// Run the graph
const result = await app.invoke({
  messages: [new HumanMessage("What's 5 + 3?")],
});
```

## Example MCP Servers

### Math Server (stdio)

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

### Weather Server (SSE)

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

## Known Limitations

### Agent Compatibility

Different agent implementations have varying requirements for tools:

1. **OpenAI Functions Agent**:

   - Most reliable with well-defined parameter schemas
   - Handles complex parameter types well

2. **React Agent**:

   - Requires the LLM to implement a `bindTools` method
   - May struggle with parsing complex tool inputs/outputs
   - More sensitive to prompt formatting

3. **LLM Compatibility**:
   - Google's Gemini models require non-empty parameter schemas
   - Some LLMs (like Anthropic Claude) have limitations on function calling

### Browser Environments

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

Enable verbose logging to diagnose issues:

```typescript
import { logger } from 'langchainjs-mcp-adapters';

// Set logger level to debug
logger.level = 'debug';
```

## License

MIT

## Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) for more information.
