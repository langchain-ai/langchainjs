# test-exports-cf

This package was generated with `wrangler init` with the purpose of testing compatibility with Cloudflare Workers.

## Test Structure

There are two sets of tests:

### Classic Tests (index.ts)

Tests for `@langchain/classic` package compatibility with Cloudflare Workers.

```bash
# Run unit tests
pnpm test:classic

# Run integration tests (requires API keys)
pnpm test:integration:classic
```

### LangChain v1 Tests (index.v1.ts)

Tests for `langchain` v1 package compatibility with Cloudflare Workers. These tests verify:

- Core message types (HumanMessage, AIMessage, SystemMessage, ToolMessage)
- Tool creation with the `tool()` function
- Document and InMemoryStore functionality
- Universal chat model initialization (`initChatModel`)
- Chain creation and composition

```bash
# Run v1 unit tests
pnpm test:v1

# Run v1 integration tests (requires API keys)
pnpm test:integration:v1

# Run all tests
pnpm test
pnpm test:integration
```

## ⚠️ Important: LangChain v1 Requires `nodejs_compat`

**LangChain v1 requires the `nodejs_compat` compatibility flag** to work in Cloudflare Workers because it uses Node.js built-in modules:

- `node:async_hooks` (from `@langchain/langgraph`)
- `node:fs/promises` and `node:path` (from `langchain/storage/file_system`)

To use LangChain v1 in your Cloudflare Worker, add the following to your `wrangler.toml`:

```toml
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
```

See `wrangler.v1.toml` for a complete example.

## Development

```bash
# Start the classic worker
pnpm start

# Start the v1 worker (uses wrangler.v1.toml with nodejs_compat)
pnpm start:v1
```

## Build

```bash
# Build classic worker
pnpm build

# Build v1 worker
pnpm build:v1
```
