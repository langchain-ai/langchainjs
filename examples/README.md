# LangChainJS-MCP-Adapters Examples

This directory contains examples demonstrating how to use the LangChainJS-MCP-Adapters library with various MCP servers, with a focus on the Firecrawl MCP server.

## Running the Examples

We've added dedicated npm scripts to make it easy to run the examples:

```bash
# Build all examples
npm run build:examples

# Run specific examples
npm run example:default    # Uses automatic loading from mcp.json
npm run example:custom     # Uses a custom configuration file
npm run example:multiple   # Uses multiple MCP servers from a config file
npm run example:mixed      # Loads one server from config and another directly in code
npm run example:enhanced   # Demonstrates all enhanced configuration features
```

## Example Descriptions

### 1. Default Configuration (`firecrawl_default_config_example.ts`)

Demonstrates the automatic loading of MCP server configurations from the default `mcp.json` file in the root directory. This example showcases how to:

- Create a client that automatically loads from `mcp.json`
- Initialize connections to all servers in the configuration
- Filter tools by server name
- Use tools with LangGraph

### 2. Custom Configuration (`firecrawl_custom_config_example.ts`)

Shows how to create and use a custom configuration file specifically for the Firecrawl server. This example:

- Creates a custom configuration file
- Initializes the client from this file
- Shows environment variable configuration

### 3. Multiple Servers (`firecrawl_multiple_servers_example.ts`)

Demonstrates loading multiple MCP servers (Firecrawl and Math) from a single configuration file. This example:

- Creates a configuration with multiple servers
- Loads and uses tools from different servers in the same agent

### 4. Mixed Loading (`firecrawl_mixed_loading_example.ts`)

Shows a mixed approach to loading MCP servers - one from a configuration file and another directly in code. This example:

- Loads the math server from a config file
- Adds the Firecrawl server via direct code
- Works with tools from both servers

### 5. Enhanced Configuration (`firecrawl_enhanced_config_example.ts`)

Showcases all the enhanced configuration features, including:

- Automatic loading from the default configuration
- Adding multiple configuration sources
- Environment variable substitution
- Adding servers directly in code

## Configuration Files

- `mcp.json` - Default configuration file in the root directory
- Custom configuration files created in the examples

## Requirements

Ensure you have the correct environment variables set in your `.env` file:

```
OPENAI_API_KEY=your_openai_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
OPENAI_MODEL_NAME=gpt-4o  # or your preferred model
```
