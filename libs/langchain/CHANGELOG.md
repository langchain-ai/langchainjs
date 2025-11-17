# langchain

## 1.0.4

### Patch Changes

- b401680: avoid invalid message order after summarization
- f63fc0f: fix(langchain): export ToolRuntime from langchain

## 1.0.3

### Patch Changes

- f1583cd: allow for model strings in summarization middleware
- e960f97: check message property when pulling chat models for vercel compat
- 66fc10c: fix(langchain): don't allow default or optional context schemas
- 0a8a23b: feat(@langchain/core): support of ToolRuntime
- b38be50: Add missing ToolMessage in toolStrategy structured output
- 42930b5: fix(langchain): improved state schema typing

## 1.0.2

### Patch Changes

- 2e45c43: fix(langchain): remove bad dynamic import for LS
- 28eceac: preserve full model name when deciding model provider

## 1.0.0

🎉 **LangChain v1.0** is here! This release provides a focused, production-ready foundation for building agents. We've streamlined the framework around three core improvements: **`createAgent`**, **standard content blocks**, and a **simplified package structure**. See the [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for complete details.

### ✨ Major Features

#### `createAgent` - A new standard for building agents

`createAgent` is the new standard way to build agents in LangChain 1.0. It provides a simpler interface than `createReactAgent` from LangGraph while offering greater customization potential through middleware.

**Key features:**

- **Clean, intuitive API**: Build agents with minimal boilerplate
- **Built on LangGraph**: Get persistence, streaming, human-in-the-loop, and time travel out of the box
- **Middleware-first design**: Highly customizable through composable middleware
- **Improved structured output**: Generate structured outputs in the main agent loop without additional LLM calls

Example:

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [getWeather],
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
});

console.log(result.content);
```

Under the hood, `createAgent` is built on the basic agent loop—calling a model using LangGraph, letting it choose tools to execute, and then finishing when it calls no more tools.

**Built on LangGraph features (work out of the box):**

- **Persistence**: Conversations automatically persist across sessions with built-in checkpointing
- **Streaming**: Stream tokens, tool calls, and reasoning traces in real-time
- **Human-in-the-loop**: Pause agent execution for human approval before sensitive actions
- **Time travel**: Rewind conversations to any point and explore alternate paths

**Structured output improvements:**

- Generate structured outputs in the main loop instead of requiring an additional LLM call
- Models can choose between calling tools or using provider-side structured output generation
- Significant cost reduction by eliminating extra LLM calls

Example:

```typescript
import { createAgent } from "langchain";
import * as z from "zod";

const weatherSchema = z.object({
  temperature: z.number(),
  condition: z.string(),
});

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [getWeather],
  responseFormat: weatherSchema,
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
});

console.log(result.structuredResponse);
```

For more information, see [Agents documentation](https://docs.langchain.com/oss/javascript/langchain/agents).

#### Middleware

Middleware is what makes `createAgent` highly customizable, raising the ceiling for what you can build. Great agents require **context engineering**—getting the right information to the model at the right time. Middleware helps you control dynamic prompts, conversation summarization, selective tool access, state management, and guardrails through a composable abstraction.

**Prebuilt middleware** for common patterns:

```typescript
import {
  createAgent,
  summarizationMiddleware,
  humanInTheLoopMiddleware,
  piiRedactionMiddleware,
} from "langchain";

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [readEmail, sendEmail],
  middleware: [
    piiRedactionMiddleware({ patterns: ["email", "phone", "ssn"] }),
    summarizationMiddleware({
      model: "anthropic:claude-sonnet-4-5-20250929",
      maxTokensBeforeSummary: 500,
    }),
    humanInTheLoopMiddleware({
      interruptOn: {
        sendEmail: {
          allowedDecisions: ["approve", "edit", "reject"],
        },
      },
    }),
  ] as const,
});
```

**Custom middleware** with lifecycle hooks:

| Hook            | When it runs             | Use cases                               |
| --------------- | ------------------------ | --------------------------------------- |
| `beforeAgent`   | Before calling the agent | Load memory, validate input             |
| `beforeModel`   | Before each LLM call     | Update prompts, trim messages           |
| `wrapModelCall` | Around each LLM call     | Intercept and modify requests/responses |
| `wrapToolCall`  | Around each tool call    | Intercept and modify tool execution     |
| `afterModel`    | After each LLM response  | Validate output, apply guardrails       |
| `afterAgent`    | After agent completes    | Save results, cleanup                   |

Example custom middleware:

```typescript
import { createMiddleware } from "langchain";

const contextSchema = z.object({
  userExpertise: z.enum(["beginner", "expert"]).default("beginner"),
});

const expertiseBasedToolMiddleware = createMiddleware({
  wrapModelCall: async (request, handler) => {
    const userLevel = request.runtime.context.userExpertise;
    if (userLevel === "expert") {
      const tools = [advancedSearch, dataAnalysis];
      return handler(request.replace("openai:gpt-5", tools));
    }
    const tools = [simpleSearch, basicCalculator];
    return handler(request.replace("openai:gpt-5-nano", tools));
  },
});

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [simpleSearch, advancedSearch, basicCalculator, dataAnalysis],
  middleware: [expertiseBasedToolMiddleware],
  contextSchema,
});
```

For more information, see the [complete middleware guide](https://docs.langchain.com/oss/javascript/langchain/middleware).

#### Simplified Package

LangChain v1 streamlines the `langchain` package namespace to focus on essential building blocks for agents. The package exposes only the most useful and relevant functionality (most re-exported from `@langchain/core` for convenience).

**What's in the core `langchain` package:**

- `createAgent` and agent-related utilities
- Core message types and content blocks
- Middleware infrastructure
- Tool definitions and schemas
- Prompt templates
- Output parsers
- Base runnable abstractions

### 🔄 Migration Notes

#### `@langchain/classic` for Legacy Functionality

Legacy functionality has moved to [`@langchain/classic`](https://www.npmjs.com/package/@langchain/classic) to keep the core package lean and focused.

**What's in `@langchain/classic`:**

- Legacy chains and chain implementations
- The indexing API
- [`@langchain/community`](https://www.npmjs.com/package/@langchain/community) exports
- Other deprecated functionality

**To migrate legacy code:**

1. Install `@langchain/classic`:

   ```bash
   npm install @langchain/classic
   ```

2. Update your imports:

   ```typescript
   import { ... } from "langchain"; // [!code --]
   import { ... } from "@langchain/classic"; // [!code ++]

   import { ... } from "langchain/chains"; // [!code --]
   import { ... } from "@langchain/classic/chains"; // [!code ++]
   ```

#### Upgrading to v1

Install the v1 packages:

```bash
npm install langchain@1.0.0 @langchain/core@1.0.0
```

### 📚 Additional Resources

- [LangChain 1.0 Announcement](https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/)
- [Migration Guide](https://docs.langchain.com/oss/javascript/migrate/langchain-v1)
- [Agents Documentation](https://docs.langchain.com/oss/javascript/langchain/agents)
- [Middleware Guide](https://blog.langchain.com/agent-middleware/)

---

## 0.3.36

### Patch Changes

- cabd762: fix(langchain): add ChatMistralAI to well known models
- Updated dependencies [e63c7cc]
- Updated dependencies [b8ffc1e]
  - @langchain/openai@0.6.16

## 0.3.35

### Patch Changes

- fd4691f: use `keyEncoder` instead of insecure cache key getter
- 2f19cd5: feat: Add Perplexity support to universal chat model
- 3c94076: fix(langchain): Bind schemas for other types of pulled hub prompts
- Updated dependencies [d38e9d6]
  - @langchain/openai@0.6.14

## 0.3.34

### Patch Changes

- 6019a7d: update JSONL loader to support complex json structures
- caf5579: prevent ConfigurableModel mutation when using withStructuredOutput or bindTools
- d60f40f: infer mistralai models
- Updated dependencies [41bd944]
- Updated dependencies [707a768]
  - @langchain/openai@0.6.12

## 0.3.33

### Patch Changes

- d2c7f09: support prompts not created from RunnableBinding

## 0.3.32

### Patch Changes

- e0bd88c: add support for conversion of ref in array schema
- Updated dependencies [4a3f5af]
- Updated dependencies [424360b]
  - @langchain/openai@0.6.10
