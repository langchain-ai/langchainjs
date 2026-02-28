# test-exports-cf

This package was generated with `wrangler init` with the purpose of testing compatibility with Cloudflare Workers.

## Test Structure

There are three sets of tests:

### Classic Tests (index.ts)

Tests for `@langchain/classic` package compatibility with Cloudflare Workers.

```bash
# Run unit tests
pnpm test:classic

# Run integration tests (requires API keys)
pnpm test:integration:classic
```

### @langchain/core Tests (index.core.ts)

Tests for `@langchain/core` v1 package compatibility with Cloudflare Workers. **These tests run WITHOUT the `nodejs_compat` flag** to verify that the dynamic import pattern works correctly.

```bash
# Run core unit tests (no nodejs_compat)
pnpm test:core
```

### LangChain v1 Tests (index.v1.ts)

Tests for the full `langchain` v1 package compatibility with Cloudflare Workers. **These tests require the `nodejs_compat` flag** because `langchain` depends on `@langchain/langgraph`, which uses static imports for `node:async_hooks`.

```bash
# Run v1 unit tests
pnpm test:v1

# Run v1 integration tests (requires API keys)
pnpm test:integration:v1

# Run all tests
pnpm test
pnpm test:integration
```

## Compatibility Summary

| Package              | `nodejs_compat` Required | Notes                                                       |
| -------------------- | ------------------------ | ----------------------------------------------------------- |
| `@langchain/core`    | ❌ No                    | Uses dynamic imports with graceful fallback                 |
| `@langchain/classic` | ❌ No                    | Uses dynamic imports with graceful fallback                 |
| `langchain` v1       | ✅ Yes                   | Depends on `@langchain/langgraph` which uses static imports |

## @langchain/core Works Without `nodejs_compat`

`@langchain/core` uses **dynamic imports** to gracefully handle environments without `node:async_hooks`. This means it can run in Cloudflare Workers **without** the `nodejs_compat` flag.

```toml
# wrangler.toml - no special flags needed for @langchain/core!
compatibility_date = "2024-09-23"
```

### How It Works

`@langchain/core` dynamically imports `node:async_hooks` at runtime using an async IIFE:

```typescript
(async () => {
  try {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    // Use real AsyncLocalStorage in Node.js
  } catch {
    // Use MockAsyncLocalStorage in CF Workers/browsers
  }
})();
```

### Limitations Without `nodejs_compat`

When running without `node:async_hooks`, a mock implementation is used. This means:

- ✅ Core functionality works (messages, tools, chains, models)
- ⚠️ Automatic context propagation is disabled (pass `config` explicitly)
- ⚠️ `LocalFileStore` is not available (Node.js only)

## Full langchain Package Requires `nodejs_compat`

The full `langchain` package depends on `@langchain/langgraph`, which currently uses static imports for `node:async_hooks`. Until langgraph is updated to use dynamic imports, users of the full `langchain` package need to enable `nodejs_compat`:

```toml
# wrangler.toml - required for full langchain package
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
```

## Development

```bash
# Start the classic worker
pnpm start

# Start the core worker (no nodejs_compat)
pnpm start:core

# Start the v1 worker (with nodejs_compat)
pnpm start:v1
```

## Build

```bash
# Build classic worker
pnpm build

# Build core worker
pnpm build:core

# Build v1 worker
pnpm build:v1
```
