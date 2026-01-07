# AGENTS.md - AI Agent Guidelines for LangChain.js

This document provides guidance for AI coding agents working with the LangChain.js codebase.

## Project Overview

LangChain.js is a TypeScript framework for building LLM-powered applications. It provides standard interfaces for agents, models, embeddings, vector stores, and more, enabling developers to chain together interoperable components and third-party integrations.

### Supported Environments

- Node.js (ESM and CommonJS) - 20.x, 22.x, 24.x
- Cloudflare Workers
- Vercel / Next.js (Browser, Serverless and Edge functions)
- Supabase Edge Functions
- Browser
- Deno
- Bun

## Repository Structure

This is a **monorepo** managed with [pnpm workspaces](https://pnpm.io/) (v10.14.0) and [Turborepo](https://turbo.build/).

### Key Packages

| Package                    | Path                                  | Description                                                      |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `langchain`                | `libs/langchain/`                     | Main LangChain package with agents, prompts, and orchestration   |
| `@langchain/core`          | `libs/langchain-core/`                | Core abstractions and interfaces (base classes, runnables, etc.) |
| `@langchain/community`     | `libs/langchain-community/`           | Community-maintained integrations                                |
| `@langchain/textsplitters` | `libs/langchain-textsplitters/`       | Text splitting utilities                                         |
| `@langchain/openai`        | `libs/providers/langchain-openai/`    | OpenAI integration                                               |
| `@langchain/anthropic`     | `libs/providers/langchain-anthropic/` | Anthropic integration                                            |
| Other providers            | `libs/providers/langchain-*/`         | First-party provider integrations                                |

### Internal Packages

| Package                     | Path                             | Description                          |
| --------------------------- | -------------------------------- | ------------------------------------ |
| `@langchain/build`          | `internal/build/`                | Build utilities                      |
| `@langchain/eslint`         | `internal/eslint/`               | Shared ESLint configuration          |
| `@langchain/tsconfig`       | `internal/tsconfig/`             | Shared TypeScript configuration      |
| `@langchain/standard-tests` | `libs/langchain-standard-tests/` | Standard test suite for integrations |

## Development Setup

### Prerequisites

- **Node.js v24.x** (check with `node -v`)
- **pnpm v10.14.0** (package manager)

### Initial Setup

```bash
# Install dependencies from root
pnpm install

# Build the core package first (required before other packages)
pnpm --filter @langchain/core build
```

## Common Commands

All commands can be run from the project root using `pnpm --filter <package>` to target specific workspaces.

### Package Filters

- `--filter langchain` - the main `langchain` package
- `--filter @langchain/core` - the core package
- `--filter @langchain/community` - community integrations
- `--filter @langchain/openai` - OpenAI integration (and similarly for other providers)

### Building

```bash
pnpm --filter langchain build
pnpm --filter @langchain/core build
```

### Linting

```bash
pnpm --filter langchain lint
pnpm --filter @langchain/core lint
```

### Formatting

```bash
pnpm --filter langchain format        # Fix formatting
pnpm --filter langchain format:check  # Check only
```

### Testing

```bash
# Unit tests
pnpm --filter langchain test
pnpm --filter @langchain/core test

# Integration tests (requires API keys)
pnpm --filter langchain test:integration

# Single test file
pnpm --filter <package> test:single <path-to-test>
```

## Coding Standards

### TypeScript Configuration

The project uses a shared TypeScript configuration from `internal/tsconfig/base.json`:

- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Source maps and declaration maps enabled

### ESLint Rules

Key rules to follow (from `internal/eslint/src/configs/base.ts`):

1. **No `instanceof`** - Use type guards instead (`no-instanceof/no-instanceof: error`)
   - For LangChain messages, use the static `isInstance` method, e.g. `AIMessage.isInstance(message)`
2. **No `process.env`** - Except in test files (`no-process-env: error`)
3. **No floating promises** - Always await or handle promises (`@typescript-eslint/no-floating-promises: error`)
4. **No explicit `any`** - Use proper types (`@typescript-eslint/no-explicit-any: error`)
5. **Prefer template literals** - Over string concatenation (`prefer-template: error`)
6. **File extensions required** - In imports (`import/extensions: error`)

### Import Conventions

```typescript
// Always include .js extension for local imports (ESM)
import { Something } from "./something.js";

// Use named exports, not default exports
export { MyClass, myFunction };
```

### Zod Schema Support

The codebase supports both Zod v3 and v4:

```typescript
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
```

## File Naming Conventions

### Source Files

- Regular modules: `my_module.ts` (snake_case)
- Index files: `index.ts`
- Type definitions: `types.ts`

### Test Files

- **Unit tests**: `*.test.ts` - Tests that don't require external APIs
- **Integration tests**: `*.int.test.ts` - Tests that call external APIs
- **Type tests**: `*.test-d.ts` - TypeScript type checking tests
- **Standard tests**: `*.standard.test.ts` / `*.standard.int.test.ts` - Standard test suite

Tests should be placed in a `tests/` folder alongside the module being tested.

## Core Abstractions

### Runnables

The `Runnable` interface (`@langchain/core/runnables`) is the foundation of LangChain. All major components extend `Runnable`:

```typescript
import {
  Runnable,
  RunnableConfig,
  RunnableLike,
} from "@langchain/core/runnables";
```

Key methods:

- `invoke(input, config?)` - Single invocation
- `stream(input, config?)` - Streaming invocation
- `batch(inputs, config?)` - Batch invocation

### Messages

Messages are in `@langchain/core/messages`:

```typescript
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
```

### Tools

Tools extend `StructuredTool` from `@langchain/core/tools`:

```typescript
import { StructuredTool, DynamicTool, tool } from "@langchain/core/tools";
```

### Chat Models

Chat models extend `BaseChatModel` from `@langchain/core/language_models/chat_models`:

```typescript
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
```

## Writing Tests

### Unit Tests

```typescript
import { test, expect, describe } from "vitest";
import { FakeChatModel } from "@langchain/core/utils/testing";

test("should do something", async () => {
  const model = new FakeChatModel({});
  const result = await model.invoke([["human", "Hello!"]]);
  expect(result.content).toBe("Hello!");
});
```

### Integration Tests

Integration tests require actual API credentials:

```typescript
import { describe, test, expect } from "vitest";
import { ChatOpenAI } from "../index.js";
import { HumanMessage } from "@langchain/core/messages";

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
    maxTokens: 10,
  });
  const message = new HumanMessage("Hello!");
  const result = await chat.invoke([message]);
  expect(typeof result.content).toBe("string");
});
```

### Type Tests

Use `expectTypeOf` from vitest for type assertions:

```typescript
import { expectTypeOf } from "vitest";

expectTypeOf(someFunction).returns.toMatchTypeOf<ExpectedType>();
```

### Standard Tests

For provider integrations, extend the standard test classes:

```typescript
import { ChatModelUnitTests } from "@langchain/standard-tests";

class MyChatModelStandardUnitTests extends ChatModelUnitTests<
  MyChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: MyChatModel,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }
}
```

## Creating New Integrations

### Provider Package Structure

New provider packages should follow this structure:

```txt
libs/providers/langchain-{provider}/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── eslint.config.ts
├── turbo.json
├── README.md
├── LICENSE
└── src/
    ├── index.ts
    ├── chat_models/
    │   ├── index.ts
    │   └── tests/
    │       ├── index.test.ts
    │       ├── index.int.test.ts
    │       ├── index.standard.test.ts
    │       └── index.standard.int.test.ts
    └── embeddings.ts (if applicable)
```

### Package.json Requirements

```json
{
  "name": "@langchain/provider-name",
  "type": "module",
  "engines": { "node": ">=20" },
  "peerDependencies": {
    "@langchain/core": "^1.0.0"
  },
  "devDependencies": {
    "@langchain/core": "workspace:*",
    "@langchain/eslint": "workspace:*",
    "@langchain/standard-tests": "workspace:*",
    "@langchain/tsconfig": "workspace:*"
  }
}
```

### Scaffolding

Use the CLI tool to create new integration packages:

```bash
npx create-langchain-integration
```

## Best Practices

### 1. Use Existing Abstractions

Before creating new classes, check if `@langchain/core` already provides what you need:

- `Runnable` and its variants
- `StructuredTool` for tools
- `BaseChatModel` for chat models
- `Embeddings` for embedding models
- `BaseRetriever` for retrievers
- `VectorStore` for vector stores

### 2. Support Streaming

All LLM-related components should support streaming when possible:

```typescript
async *_streamResponseChunks(
  messages: BaseMessage[],
  options: this["ParsedCallOptions"],
  runManager?: CallbackManagerForLLMRun
): AsyncGenerator<ChatGenerationChunk> {
  // Yield chunks as they arrive
}
```

### 3. Handle Callbacks Properly

Use the callback manager for tracing and observability:

```typescript
await runManager?.handleLLMNewToken(token);
```

### 4. Environment Variables

Access environment variables using the utility:

```typescript
import { getEnvironmentVariable } from "@langchain/core/utils/env";

const apiKey = getEnvironmentVariable("MY_API_KEY");
```

### 5. Error Handling

Use typed errors with proper error codes:

```typescript
throw new Error("Model authentication failed", {
  cause: { lc_error_code: "MODEL_AUTHENTICATION" },
});
```

### 6. Third-Party Dependencies

- Add external dependencies as `peerDependencies` in `@langchain/community`
- Add them as regular `dependencies` in standalone provider packages
- Always use caret (`^`) for version ranges
- Ensure dependencies are MIT or permissively licensed

## Pull Request Checklist

Before submitting a PR:

1. [ ] Run `pnpm lint` and fix any issues
2. [ ] Run `pnpm format` to format code
3. [ ] Add/update unit tests (`*.test.ts`)
4. [ ] Add/update integration tests if applicable (`*.int.test.ts`)
5. [ ] Add/update type tests if changing public APIs (`*.test-d.ts`)
6. [ ] Update documentation if changing public APIs
7. [ ] Keep changes focused - one feature/fix per PR
8. [ ] Ensure no circular dependencies (checked by `lint:dpdm`)

## Debugging Tips

### Running Specific Tests

```bash
# Run a single test file
pnpm --filter @langchain/core test src/messages/tests/utils.test.ts

# Run tests matching a pattern
pnpm --filter @langchain/core test --grep "should handle"

# Watch mode
pnpm --filter @langchain/core test:watch
```

### Building in Watch Mode

```bash
pnpm watch
```

### Checking for Circular Dependencies

```bash
pnpm --filter @langchain/core lint:dpdm
```

## Resources

- [Documentation](https://docs.langchain.com/oss/javascript/langchain/overview)
- [API Reference](https://api.js.langchain.com)
- [GitHub Issues](https://github.com/langchain-ai/langchainjs/issues)
- [LangChain Forum](https://forum.langchain.com)
- [Contributing Guide](./CONTRIBUTING.md)
- [Integration Guide](./.github/contributing/INTEGRATIONS.md)
