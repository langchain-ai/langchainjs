# LangChainJS-MCP-Adapters Examples

This directory contains examples demonstrating how to use the `@langchain/mcp-adapters` library with various MCP servers

## Running the Examples

```bash
# type check examples
pnpm --filter @langchain/mcp-adapters build:examples

# Run specific example
cd examples && pnpm exec tsx firecrawl_custom_config_example.ts
```

## Modern and mixed servers (no model credentials)

From this directory, run `pnpm exec tsx modern_server.ts`, then in another terminal
run `pnpm exec tsx modern_client.ts`. The client prints `Hello MCP` and closes its
connection. The server uses modern MCP with a fresh server instance per request.

To try mixed modes, also run `pnpm exec tsx calculator_server_shttp_sse.ts` and then
`pnpm exec tsx modern_client.ts --mixed`. The client invokes modern `echo` and legacy
`add`, printing `Hello MCP` and `5`. Stop servers with Ctrl-C.

## Legacy and agent examples

For modern input, start `modern_server.ts` and run
`pnpm exec tsx modern_elicitation.ts`. It prints three successive interruptions
(two forms and a URL), reconstructs the adapter between rounds, and completes.
Pass `decline` or `cancel` to stop at the first question. Answers and the URL are
scripted demo data; a production application collects consent and verifies URL
completion. `MemorySaver` survives adapter reconstruction in this process, not
a process restart; use a persistent checkpointer for that.

`oauth.ts` is a typed application recipe rather than a standalone OAuth server.
It accepts real SDK provider implementations, completes a saved OAuth attempt
with the full callback query, and shows the token-broker route. It has no
embedded credentials or browser/credential-storage implementation.

Start `calculator_server_shttp_sse.ts`, then run
`pnpm exec tsx legacy_elicitation.ts accept` (or `decline` / `cancel`). The client
answers one form request and one URL request using a per-server callback. The
URL and answers are scripted demo data; no external authorization occurs.

For content conversion, start `modern_server.ts` and run
`pnpm exec tsx content.ts`. The hook prints standard text/image blocks separately
from the `mcp_structured_content` and `mcp_meta` artifacts. The metadata does not
appear in model-facing text. `hooks.ts` demonstrates argument/result changes
with the legacy filesystem server.

The calculator server uses legacy sessions, even though it imports SDK 2.
Its clients must explicitly set `mode: "legacy"`.

### Filesystem LangGraph Example (`filesystem_langgraph_example.ts`)

Demonstrates using the Filesystem MCP server with LangGraph to create a structured workflow for complex file operations. The example creates a graph-based agent that can perform various file operations like creating multiple files, reading files, creating directory structures, and organizing files.

### Firecrawl - Custom Configuration (`firecrawl_custom_config_example.ts`)

Shows how to initialize the Firecrawl MCP server with a custom configuration. The example sets up a connection to Firecrawl using SSE transport, loads tools from the server, and creates a agent to perform web scraping tasks and find news about artificial intelligence.

### Firecrawl - Multiple Servers (`firecrawl_multiple_servers_example.ts`)

Demonstrates how to use multiple MCP servers simultaneously by configuring both Firecrawl for web scraping and a Math server for calculations. The example creates a agent that can use tools from both servers to answer queries involving both math calculations and web content retrieval.

### LangGraph - Simple Config (`langgraph_example.ts`)

Shows a straightforward integration of LangGraph with MCP tools, creating a flexible agent workflow. The example demonstrates how to set up a graph-based structure with separate nodes for LLM reasoning and tool execution, with conditional routing between nodes based on whether tool calls are needed.

### Launching a Containerized MCP Server (`mcp_over_docker_example.ts`)

Shows how to run an MCP server inside a Docker container. This example configures a connection to a containerized Filesystem MCP server with appropriate volume mounting, demonstrating how to use Docker to isolate and run MCP servers while still allowing file operations.

## Requirements

Ensure you have the correct environment variables set in your `.env` file:

```
OPENAI_API_KEY=your_openai_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
OPENAI_MODEL_NAME=gpt-4o  # or your preferred model
```
