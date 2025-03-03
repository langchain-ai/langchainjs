# MCP Adapter Examples

This directory contains examples demonstrating how to use the LangChain.js MCP (Machine Communication Protocol) adapter with various configurations and use cases.

## Basic Examples

### Math Server Example

`math_example.ts` - A simple example demonstrating how to use the MCP adapter with a math server via stdio transport.

```bash
node --loader ts-node/esm examples/math_example.ts
```

### SSE Example

`sse_example.ts` - Demonstrates how to use the MCP adapter with a server using SSE (Server-Sent Events) transport.

```bash
# First start the weather server
python examples/weather_server.py

# Then run the example
node --loader ts-node/esm examples/sse_example.ts
```

### Logging Example

`logging_example.ts` - Demonstrates how to use the built-in Winston logger with the MCP adapter for detailed logging of client operations.

```bash
# First start both servers
python examples/math_server.py &
python examples/weather_server.py &

# Then run the example
node --loader ts-node/esm examples/logging_example.ts
```

## Configuration Examples

### Transport Configuration Example

`transport_config_example.ts` - Shows how to create an MCP client with a custom configuration that specifies different transport types for different servers.

```bash
# First start the weather server
python examples/weather_server.py

# Then run the example
node --loader ts-node/esm examples/transport_config_example.ts
```

### JSON Configuration Example

`json_config_example.ts` - Demonstrates how to load server configurations from JSON files.

```bash
# First start the weather server
python examples/weather_server.py

# Then run the example
node --loader ts-node/esm examples/json_config_example.ts
```

## Multi-Server Examples

### Multi-Transport Example

`multi_transport_example.ts` - Shows how to connect to multiple servers using different transport methods (stdio and SSE) and how to use tools from different servers.

```bash
# First start the weather server
python examples/weather_server.py

# Then run the example
node --loader ts-node/esm examples/multi_transport_example.ts
```

## LLM Integration Examples

### Agent Example

`agent_example.ts` - Demonstrates how to use MCP tools with a LangChain agent using OpenAI.

```bash
# Set your OpenAI API key in a .env file
echo "OPENAI_API_KEY=your-api-key" > .env

# Start the servers
python examples/math_server.py &
python examples/weather_server.py &

# Run the example
node --loader ts-node/esm examples/agent_example.ts
```

### Gemini Example

`gemini_example.ts` - Shows how to use MCP tools with Google's Gemini model.

```bash
# Set your Google API key in a .env file
echo "GOOGLE_API_KEY=your-api-key" > .env

# Start the servers
python examples/math_server.py &
python examples/weather_server.py &

# Run the example
node --loader ts-node/esm examples/gemini_example.ts
```

### Gemini Agent Example

`gemini_agent_example.ts` - Demonstrates how to use MCP tools with a LangChain agent using Google's Gemini model.

```bash
# Set your Google API key in a .env file
echo "GOOGLE_API_KEY=your-api-key" > .env

# Start the servers
python examples/math_server.py &
python examples/weather_server.py &

# Run the example
node --loader ts-node/esm examples/gemini_agent_example.ts
```

## Server Examples

### Math Server

`math_server.py` - A simple Python server that provides math operations (add, multiply) via the MCP protocol.

### Weather Server

`weather_server.py` - A Python server that provides weather information (temperature, forecast) via the MCP protocol with SSE transport.

```bash
# Run the weather server
python examples/weather_server.py

# By default, it runs on port 8000
# You can specify a different port using command line arguments:
python examples/weather_server.py --sse-port 8001
```

## Configuration Files

### Simple MCP Configuration

`simple_mcp.json` - A simple configuration file for the MCP client that specifies a math server and a weather server.

### Complex MCP Configuration

`complex_mcp.json` - A more complex configuration file that includes environment variables and additional server configurations.

## Logging

The MCP adapter includes a built-in logging system using Winston. The logger provides the following features:

- Different log levels (error, warn, info, http, debug)
- Colorized console output
- File logging for errors and all logs
- Environment-aware log levels (more verbose in development, less in production)

To use the logger in your own code:

```typescript
import { MultiServerMCPClient } from "../src/client.js";
import logger from "../src/logger.js";

// Use the logger
logger.info("Starting MCP client");
logger.debug("Detailed debug information");
logger.warn("Warning message");
logger.error("Error message");

// The client uses the logger internally
const client = new MultiServerMCPClient({...});
```

Log files are stored in the `logs` directory:

- `logs/error.log`: Contains only error-level logs
- `logs/all.log`: Contains all logs
