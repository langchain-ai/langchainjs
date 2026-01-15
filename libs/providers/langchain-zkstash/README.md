# @langchain/zkstash

[![npm version](https://img.shields.io/npm/v/@langchain/zkstash.svg?style=flat-square)](https://www.npmjs.com/package/@langchain/zkstash)

This package provides integrations for [zkStash](https://zkstash.ai/) memory engine within LangChain.js. zkStash is a managed memory engine built specifically for AI agents (LLMs), enabling real-time extraction and retrieval of structured, long-term knowledge across all your agentic workflows.

This package exposes five integrations:

- `ZkStashMemory`: High-performance middleware for `createAgent` that automatically manages context injection and knowledge extraction.
- `ZkStashStore`: A persistent `BaseStore` for structured knowledge and Long-Term Memory (LTM).
- `ZkStashRetriever`: Semantic search for retrieving zkstash memories as LangChain Documents.

> **Note:** For more information on how to use these integrations, see the [zkStash documentation](https://zkstash.ai/docs).

## Installation

```bash npm2yarn
npm install @langchain/zkstash
```

## Setup

You need a zkStash API key or a EVM/SVM private key to use this package. You can get an API key [here](https://zkstash.ai). Set it as an environment variable:

```typescript
process.env.ZKSTASH_API_KEY = "YOUR_API_KEY";
```

## Usage

### Middleware Pattern (`createAgent`)

In LangChain v1, `ZkStashMemory` acts as a high-performance **Middleware** for the `createAgent` API. It handles context injection and knowledge extraction automatically.

```typescript
import { createAgent } from "langchain";
import { zkStashMemoryMiddleware } from "@langchain/zkstash";

// 1. Create Agent with zkStashMemory middleware
const agent = createAgent({
  model: "openai:gpt-5.1",
  tools: [],
  middleware: [
    zkStashMemoryMiddleware({
      apiKey: process.env.ZKSTASH_API_KEY, 
      schemas: ["user_plans"],
      filters: { 
        agentId: "personal-assistant",
        threadId: "conversation-001"
      },
      searchContextWindow: 3
    })
  ]
});

// During invocation:
// - beforeModel: Relevant facts are injected into the context.
// - afterModel: New insights are automatically extracted to zkStash.
await agent.invoke({
  messages: [{ role: "user", content: "I'm planning a hiking trip to Italy next May." }]
});
```

### Deep Agent Filesystem

zkStash is the ideal backend for the **Deep Agent** persistent filesystem. By routing the `/memories/` path to `ZkStashStore`, you enable agents to use standard filesystem tools (`ls`, `read_file`, `write_file`) to manage their long-term knowledge.

```typescript
import { createDeepAgent, CompositeBackend, StateBackend, StoreBackend } from "deepagents";
import { ZkStashStore } from "@langchain/zkstash";

const memoryStore = new ZkStashStore({
  apiKey: process.env.ZKSTASH_API_KEY,
  agentId: "researcher-01"
});

const agent = createDeepAgent({
  memoryStore, // Powering the StoreBackend
  backend: (config) => new CompositeBackend(
    new StateBackend(config), // Short-term (thread-local)
    { "/memories/": new StoreBackend(config) } // Long-term (zkStash)
  ),
});

// Agent writes to zkStash via standard tool call:
// "I will save the research summary to /memories/italy_trip.txt"
```

While LangGraph checkpointers handle the *episodic* state (message history), `ZkStashStore` or `ZkStashRetriever` are used for *semantic* long-term state.

```typescript
import { ZkStashRetriever } from "@langchain/zkstash";
import { StateGraph } from "@langchain/langgraph";

// In a LangGraph node:
async function myNode(state: typeof MessagesState) {
  const retriever = new ZkStashRetriever({
    apiKey: "...",
    filters: { agentId: "global-context", kind: "project_facts" }
  });

  // Pull relevant structural knowledge for the current turn
  const context = await retriever.invoke(state.messages.at(-1).content);
  
  // ... run LLM with context
}
```

### 💾 Structural Persistence with `ZkStashStore`

Use the `BaseStore` implementation as a persistent, semantic-native alternative to Redis or In-Memory stores.

```typescript
import { ZkStashStore } from "@langchain/zkstash";

const store = new ZkStashStore({
  apiKey: "...",
  agentId: "persistent-brain"
});

// Store structured data directly into a schema (e.g., 'user_bio')
await store.mset([
  ["user_bio", { name: "Alice", tone: "analytical" }],
  ["user_goals", { goals: ["learn to code", "travel the world"] }],
]);

// Retrieve it later by schema key
const bio = await store.mget(["user_bio"]);
```

## Advanced Configuration

`ZkStashRetriever` supports multiple search modes:
- `raw`: Returns structured JSON records (default).
- `answer`: Uses the zkStash backend to synthesize a natural language response from memories.
- `map`: Returns a concise mapped representation.

### Agent Agency (Tools)

For memory management in the "hot path". zkStash exposes tools to dynamically manage memory based on your defined memory schemas. 

> **Note:** For more information on how to use these tools, see the [zkStash documentation](https://zkstash.ai/docs).

## Development

```bash
pnpm install
pnpm build --filter @langchain/zkstash
pnpm test
```

## License

This package is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.