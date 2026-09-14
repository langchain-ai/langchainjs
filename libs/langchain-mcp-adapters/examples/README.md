# MCP adapter examples

Run these examples from a LangChain.js checkout with workspace dependencies installed.
The local server/client examples need no model credentials.

## Run an example

```bash
# From the repository root, type-check all examples.
pnpm --filter @langchain/mcp-adapters build:examples

# Run the local modern server.
cd libs/langchain-mcp-adapters/examples
pnpm exec tsx modern_server.ts
```

The commands below run from this directory. When copying a client example into
your application, replace `../src/index.js` with `@langchain/mcp-adapters` and
install the packages it imports directly. Server examples also import the official
MCP server packages and Zod.

## Modern and mixed servers (no model credentials)

From this directory, run `pnpm exec tsx modern_server.ts`, then in another terminal
run `pnpm exec tsx modern_client.ts`. The client prints `Hello MCP` and closes its
connection. The server uses modern MCP with a fresh server instance per request.

To try mixed modes, also run `pnpm exec tsx calculator_server_shttp_sse.ts` and then
`pnpm exec tsx modern_client.ts --mixed`. The client invokes modern `echo` and legacy
`add`, printing `Hello MCP` and `5`. Stop servers with Ctrl-C.

## Legacy elicitation

Start `calculator_server_shttp_sse.ts`, then run
`pnpm exec tsx legacy_elicitation.ts accept` (or `decline` / `cancel`). The client
answers one form request and one URL request using a per-server callback. The
URL and answers are scripted demo data; no external authorization occurs.

## Standard tool content

For content conversion, start `modern_server.ts` and run
`pnpm exec tsx content.ts`. The hook prints standard text/image blocks separately
from the `mcp_structured_content` and `mcp_meta` artifacts. The metadata does not
appear in model-facing text. `hooks.ts` demonstrates argument/result changes
with the legacy filesystem server.

## Legacy and agent examples

The calculator server uses legacy sessions, even though it imports SDK 2.
Its clients must explicitly set `mode: "legacy"`.

### Filesystem LangGraph Example (`filesystem_langgraph_example.ts`)

Build a LangGraph agent that reads and writes files through the filesystem server.

### Firecrawl - Custom Configuration (`firecrawl_custom_config_example.ts`)

Connect to a legacy Firecrawl SSE endpoint and pass its scraping tools to `createAgent`.

### Firecrawl - Multiple Servers (`firecrawl_multiple_servers_example.ts`)

Give one agent tools from Firecrawl and a math server.

### LangGraph - Simple Config (`langgraph_example.ts`)

Build a graph with separate model and tool nodes, routing between them when the model requests a tool call.

### Launching a Containerized MCP Server (`mcp_over_docker_example.ts`)

Run the filesystem server in Docker with a mounted working directory.

## Agent example requirements

The OpenAI agent examples require `OPENAI_API_KEY`. Firecrawl examples also
require `FIRECRAWL_API_KEY` and an available Firecrawl server; the SSE example
accepts `FIRECRAWL_SERVER_URL`. Set `OPENAI_MODEL_NAME` to choose a model.
The Docker example requires a running Docker daemon.
