# Middleware Primitives

This document describes the core middleware primitives provided by `@langchain/core/middleware` that power the LangChain agents framework.

## Overview

Middleware allows you to hook into the agent lifecycle to add custom behavior like logging, caching, human-in-the-loop approval, rate limiting, and more. The middleware system provides:

## Creating Middleware

### `createMiddleware(config)`

Factory function to create middleware with automatic type inference from Zod schemas.

```typescript
import { createMiddleware } from "@langchain/core/middleware";
import { z } from "zod";

const myMiddleware = createMiddleware({
  name: "MyMiddleware",

  // Optional: Define persisted state
  stateSchema: z.object({
    count: z.number().default(0),
  }),

  // Optional: Define per-invocation context
  contextSchema: z.object({
    userId: z.string(),
  }),

  // Optional: Lifecycle hooks
  beforeAgent: async (state, runtime) => {
    /* ... */
  },
  beforeModel: async (state, runtime) => {
    /* ... */
  },
  afterModel: async (state, runtime) => {
    /* ... */
  },
  afterAgent: async (state, runtime) => {
    /* ... */
  },

  // Optional: Request interception
  wrapModelCall: async (request, handler) => {
    /* ... */
  },
  wrapToolCall: async (request, handler) => {
    /* ... */
  },

  // Optional: Additional tools
  tools: [myTool],

  // Optional: Control flow restrictions
  afterModelJumpTo: ["model", "tools", "end"],
});
```

**Configuration:**

- `name` - Unique identifier (required)
- `stateSchema` - Zod schema for state that persists across invocations
- `contextSchema` - Zod schema for read-only per-invocation context
- `beforeAgent/Model/AfterModel/Agent` - Lifecycle hooks
- `wrapModelCall/wrapToolCall` - Request interceptors
- `tools` - Additional tools to register
- `*JumpTo` - Allowed control flow targets for each hook

## Core Interfaces

### `AgentMiddleware`

The primary interface representing a middleware instance. Returned by `createMiddleware()` and accepted by `createAgent()`.

### `AgentBuiltInState`

Base state properties available to all agents:

- `messages: BaseMessage[]` - Conversation history
- `structuredResponse?: Record<string, unknown>` - Output when responseFormat is configured

All middleware state extends this built-in state.

### `MiddlewareResult<TState>`

Return type for lifecycle hooks. Return partial state updates or `void`:

```typescript
// Update state
return { myProperty: newValue };

// No updates
return;
```

## Lifecycle Hooks

Middleware can hook into four key points in the agent execution:

### `beforeAgent(state, runtime)`

**When:** Once at the start of agent execution, before any model calls

**Use cases:**

- Initialize middleware state
- Validate input messages
- Early routing decisions

```typescript
beforeAgent: async (state, runtime) => {
  console.log("Agent starting");
  return { initialized: true };
};
```

### `beforeModel(state, runtime)`

**When:** Before each model invocation (may be called multiple times)

**Use cases:**

- Modify messages before model sees them
- Add dynamic context
- Check rate limits

```typescript
beforeModel: async (state, runtime) => {
  // Add timestamp to messages
  const lastMsg = state.messages[state.messages.length - 1];
  lastMsg.additional_kwargs.timestamp = Date.now();
};
```

### `afterModel(state, runtime)`

**When:** After model responds, before tool execution

**Use cases:**

- Intercept tool calls (e.g., for human approval)
- Modify tool arguments
- Implement control flow jumps

```typescript
afterModel: async (state, runtime) => {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg.tool_calls?.length > 10) {
    throw new Error("Too many tool calls");
  }
};
```

### `afterAgent(state, runtime)`

**When:** Once after agent completes execution

**Use cases:**

- Cleanup operations
- Final logging
- Metrics collection

```typescript
afterAgent: async (state, runtime) => {
  console.log(`Agent completed in ${runtime.runModelCallCount} calls`);
};
```

## Request Interception

### `wrapModelCall(request, handler)`

Intercept and modify model invocations. The request contains:

- `model` - The language model
- `messages` - Messages to send
- `systemPrompt` - System message
- `toolChoice` - Tool selection strategy
- `tools` - Available tools
- `state` - Current agent state
- `runtime` - Runtime context

```typescript
wrapModelCall: async (request, handler) => {
  // Modify the request
  const modifiedRequest = {
    ...request,
    systemPrompt: "You are a helpful assistant",
  };

  // Call the model
  try {
    return await handler(modifiedRequest);
  } catch (error) {
    // Fallback to different model
    return await handler({ ...request, model: fallbackModel });
  }
};
```

### `wrapToolCall(request, handler)`

Intercept and modify tool executions. The request contains:

- `toolCall` - The tool call (id, name, args)
- `tool` - The BaseTool instance
- `state` - Current agent state
- `runtime` - Runtime context

```typescript
wrapToolCall: async (request, handler) => {
  console.log(`Calling ${request.toolCall.name}`);

  // Check permissions
  if (!isAuthorized(request.toolCall.name)) {
    return new ToolMessage({
      content: "Unauthorized",
      tool_call_id: request.toolCall.id,
    });
  }

  // Execute the tool
  return await handler(request);
};
```

## State and Context

### State (`stateSchema`)

**Persisted** data that survives across agent invocations:

```typescript
stateSchema: z.object({
  totalCalls: z.number().default(0),
  cache: z.record(z.any()).default({}),
});
```

- Checkpointed with agent state
- Mutable via hook return values
- Use for: counters, caches, accumulated data

### Context (`contextSchema`)

**Read-only** data provided at invocation time:

```typescript
contextSchema: z.object({
  userId: z.string(),
  features: z.array(z.string()).optional()
})

// Usage
await agent.invoke(
  { messages: [...] },
  { context: { userId: "123", features: ["premium"] } }
);
```

- Not persisted between runs
- Fresh for each invocation
- Use for: user preferences, request metadata, feature flags

### Private Properties

Prefix property names with `_` to make them private (not exposed to user):

```typescript
stateSchema: z.object({
  publicCount: z.number(),
  _internalCache: z.record(z.any()), // Not part of user-facing type
});
```

## Runtime

The `runtime` parameter passed to hooks provides access to:

### Context Access

```typescript
runtime.context.userId; // From contextSchema
runtime.context.features;
```

### Metrics

```typescript
runtime.runModelCallCount; // Calls in current run
runtime.threadLevelCallCount; // Calls across all runs in thread
```

### LangGraph Primitives

```typescript
runtime.configurable.thread_id; // Thread identifier
runtime.interrupt(data); // Pause for user input
runtime.writer; // Stream updates
runtime.signal; // Abort signal
```

## Control Flow

### Jump Targets: `JumpToTarget`

Redirect agent execution from hooks using the `jumpTo` state property:

- `"model"` - Jump back to model for another LLM call
- `"tools"` - Jump to tool execution (requires tool calls)
- `"end"` - End agent execution

```typescript
afterModel: async (state, runtime) => {
  if (shouldRetry) {
    return { jumpTo: "model" }; // Call model again
  }
};
```

### Declaring Allowed Jumps

Restrict which jumps are allowed from each hook:

```typescript
createMiddleware({
  name: "RetryMiddleware",
  afterModelJumpTo: ["model"], // Only allow jumping back to model
  afterModel: async (state, runtime) => {
    if (needsRetry) {
      return { jumpTo: "model" }; // Allowed
    }
    // return { jumpTo: "end" };  // Would throw error
  },
});
```

## Type Inference

The middleware system provides helper types to extract state and context types from middleware arrays:

### State Inference

```typescript
// Get output state from middleware
type MyState = InferMiddlewareState<typeof myMiddleware>;

// Get output state from multiple middleware
type AllStates = InferMiddlewareStates<typeof middlewareArray>;

// Get input state (with optional defaults)
type InputState = InferMiddlewareInputStates<typeof middlewareArray>;
```

### Context Inference

```typescript
// Get context from middleware
type MyContext = InferMiddlewareContext<typeof myMiddleware>;

// Get merged context from multiple middleware
type AllContexts = InferMiddlewareContextInputs<typeof middlewareArray>;
```

These types are automatically used by the agent to provide type-safe invocation.
