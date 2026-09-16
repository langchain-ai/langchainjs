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
`add`, printing `Hello MCP` and `5`. Neither server needs a `mode`; the SDK detects
their protocols. Stop servers with Ctrl-C.

## Modern elicitation with LangGraph

For modern input, start `modern_server.ts` and run
`pnpm exec tsx modern_elicitation.ts`. The example builds a `createAgent` run
over the MCP tools, prints three successive interruptions (two forms and a URL),
reconstructs the adapter between rounds, and completes. Pass `decline` or
`cancel` to stop at the first question. Answers and the URL are scripted demo
data; a production application collects consent and verifies URL completion.
`MemorySaver` survives adapter reconstruction in this process, not a process
restart; use a persistent checkpointer for that.

Answer with
`new Command({ resume: createMCPElicitationResume(pending, responses) })`, where
`pending` is the surfaced MCP interrupt and `responses` maps its request keys to
answers. The helper produces `{ [pending.id]: { responses } }` so the answer
reaches the question it was written for; a flat answer map is rejected. An
invalid answer reissues the question with a validation error instead of being
sent to the server.

**Resuming replays the tool call.** The agent re-runs its tool node from the
top, the adapter re-issues the initial `tools/call`, and only then sends the
answered follow-up — carrying the request state returned by the response that
execution just replayed. Rounds already answered are replayed too, so work the
server performed before asking happens again and `beforeToolCall` runs once per
execution. There are no exactly-once effects: keep server handlers and hooks
replay-safe.

The modern approval flow signs its retry state with an ephemeral key for this
single-process demo and binds it to the MCP method, because replayed state
travels over the wire on every round and must not be trusted as received. A
production application must supply a stable shared key and bind retry state to
its authenticated principal; this example does not implement external
authentication.

If you copy this example into your application, install `@langchain/mcp-adapters`,
`@langchain/core`, `@langchain/langgraph`, `langchain` and `zod`.

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
Clients can negotiate automatically, or set `mode: "legacy"` to skip probing.

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
