# 🦜🍎️ @langchain/agents

This package provides LangChain's prebuilt, reusable agent components, designed to help you construct agentic systems quickly and reliably. The package is built on top of [LangGraph](https://github.com/langchain-ai/langgraphjs) and provides a React-style agent implementation.

**Note:** this package is exposed through the main [`langchain`](https://www.npmjs.com/package/langchain) NPM package.

## Prerequisites

Before you start, ensure you have the following:

- Node.js 18 or higher
- An LLM API key (e.g., OpenAI, Anthropic, etc.)

## Installation

Install the required dependencies:

```bash
npm install langchain
```

You'll also need to install your preferred LLM provider package:

```bash
# For OpenAI
npm install @langchain/openai

# For Anthropic
npm install @langchain/anthropic

# For other providers, see the LangChain documentation
```

## Quick Start

### 1. Create a Basic Agent

Use `createReactAgent` to instantiate an agent with tools:

```typescript
import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const getWeather = tool(
  async (input: { city: string }) => {
    return `It's always sunny in ${input.city}!`;
  },
  {
    name: "getWeather",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
    description: "Get weather for a given city.",
  }
);

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  prompt: "You are a helpful assistant",
});

// Run the agent
const response = await agent.invoke({
  messages: [{ role: "user", content: "what is the weather in sf" }],
});

console.log(response.messages);
```

### 2. Configure Your LLM

You can configure your LLM with specific parameters:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
  temperature: 0,
  maxTokens: 1024,
});

const agent = createReactAgent({
  llm,
  tools: [getWeather],
});
```

### 3. Add Custom Prompts

Prompts instruct the LLM how to behave. They can be static strings or dynamic functions:

#### Static Prompt

```typescript
const agent = createReactAgent({
  llm,
  tools: [getWeather],
  // A static prompt that never changes
  prompt:
    "You are a weather assistant. Always be enthusiastic about the weather!",
});
```

#### Dynamic Prompt

```typescript
import { SystemMessage } from "@langchain/core/messages";

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  // A dynamic prompt function
  prompt: async (state) => {
    const userMessage = state.messages[state.messages.length - 1];
    return [
      new SystemMessage(
        `You are helping user: ${userMessage.content}. Be helpful!`
      ),
    ];
  },
});
```

### 4. Add Memory (Persistence)

To enable multi-turn conversations, provide a checkpointer:

```typescript
import { MemorySaver } from "langchain";

const checkpointer = new MemorySaver();

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  checkpointer,
});

// Run with a thread ID for persistence
const config = { configurable: { thread_id: "conversation-1" } };

const sfResponse = await agent.invoke(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  config
);

const nyResponse = await agent.invoke(
  { messages: [{ role: "user", content: "what about new york?" }] },
  config
);
```

When you enable the checkpointer, the agent automatically maintains conversation history across multiple invocations with the same `thread_id`.

### 5. Structured Output

To produce structured responses conforming to a schema, use the `responseFormat` parameter:

```typescript
import { z } from "zod";

const WeatherResponse = z.object({
  city: z.string(),
  conditions: z.string(),
  temperature: z.number(),
});

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  responseFormat: WeatherResponse,
});

const response = await agent.invoke({
  messages: [{ role: "user", content: "what is the weather in sf" }],
});

// Access the structured response
console.log(response.structuredResponse);
// { city: "San Francisco", conditions: "sunny", temperature: 72 }
```

You can also provide a custom prompt for structured output:

```typescript
const agent = createReactAgent({
  llm,
  tools: [getWeather],
  responseFormat: {
    prompt: "Format the weather information clearly and concisely",
    schema: WeatherResponse,
  },
});
```

## Advanced Features

### Streaming

You can stream responses from your agent:

```typescript
const stream = await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "values" }
);

for await (const chunk of stream) {
  console.log("---");
  console.log(chunk.messages);
}
```

### Interrupts

Add interrupts before or after specific nodes:

```typescript
const agent = createReactAgent({
  llm,
  tools: [getWeather],
  interruptBefore: ["tools"], // Interrupt before calling tools
  interruptAfter: ["agent"], // Interrupt after the agent responds
});
```

### Pre and Post Processing Hooks

Add custom processing before or after the main agent node:

```typescript
import { RunnableLambda } from "@langchain/core/runnables";

const agent = createReactAgent({
  llm,
  tools: [getWeather],
  // Trim message history if it gets too long
  preModelHook: (state) => {
    if (state.messages.length > 20) {
      return {
        messages: state.messages.slice(-10), // Keep last 10 messages
      };
    }
    return {};
  },
  // Validate responses
  postModelHook: (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    console.log("Agent responded:", lastMessage.content);
    return {};
  },
});
```

### Agent Names and Multi-Agent Systems

You can assign names to agents for use in multi-agent systems:

```typescript
const weatherAgent = createReactAgent({
  llm,
  tools: [getWeather],
  name: "weather_assistant",
  includeAgentName: "inline", // Include name in message content
});
```

## API Reference

### `createReactAgent<A, StructuredResponseFormat>(params)`

Creates a React-style agent that can use tools and maintain conversation state.

#### Type Parameters

- **`A`**: The annotation root type for custom state schema (defaults to `MessagesAnnotation`)
- **`StructuredResponseFormat`**: The type for structured response format (defaults to `Record<string, any>`)

#### Parameters

The `params` object accepts the following properties:

##### Required Parameters

- **`llm`**: `LanguageModelLike`

  - The chat model that supports tool calling (e.g., `ChatOpenAI`, `ChatAnthropic`)
  - Must support `.bindTools()` method for tool calling functionality

- **`tools`**: `ToolNode | (ServerTool | ClientTool)[]`
  - Array of tools or a `ToolNode` instance
  - `ClientTool` types: `StructuredToolInterface`, `DynamicTool`, or `RunnableToolLike`
  - `ServerTool` type: `Record<string, unknown>` for server-side tools

##### Optional Parameters

- **`prompt`**: `Prompt`

  ```typescript
  type Prompt =
    | SystemMessage
    | string
    | ((
        state: MessagesState,
        config: LangGraphRunnableConfig
      ) => BaseMessageLike[])
    | ((
        state: MessagesState,
        config: LangGraphRunnableConfig
      ) => Promise<BaseMessageLike[]>)
    | Runnable;
  ```

  - Static string: Converted to `SystemMessage` and prepended to messages
  - `SystemMessage`: Added to the beginning of the message list
  - Function: Takes full graph state and returns messages for the LLM
  - `Runnable`: A runnable that processes state and returns messages

- **`stateSchema`**: `A extends AnyAnnotationRoot | InteropZodObject`

  - Custom state schema for the agent graph
  - Defaults to `MessagesAnnotation` if not provided

- **`checkpointer`** | **`checkpointSaver`**: `BaseCheckpointSaver | boolean`

  - Checkpoint saver for persistence (e.g., `MemorySaver`, `SqliteSaver`)
  - Set to `true` to use default in-memory checkpointer
  - Both properties are aliases - use either one

- **`interruptBefore`**: `("agent" | "tools")[] | All`

  - Array of node names to interrupt execution before
  - Use `All` to interrupt before all nodes
  - Available nodes: `"agent"`, `"tools"`

- **`interruptAfter`**: `("agent" | "tools")[] | All`

  - Array of node names to interrupt execution after
  - Use `All` to interrupt after all nodes
  - Available nodes: `"agent"`, `"tools"`

- **`store`**: `BaseStore`

  - Base store for additional state management beyond checkpointing

- **`responseFormat`**: `InteropZodType<StructuredResponseFormat> | StructuredResponseSchemaOptions<StructuredResponseFormat> | Record<string, any>`

  ```typescript
  type StructuredResponseSchemaOptions<T> = {
    schema: InteropZodType<T> | Record<string, any>;
    prompt?: string;
    strict?: boolean;
    [key: string]: unknown;
  };
  ```

  - Zod schema for structured output validation
  - Object with `schema` and optional `prompt` for custom instructions
  - JSON schema object
  - **Note**: Requires model to support `.withStructuredOutput()`

- **`name`**: `string`

  - Optional name identifier for the agent
  - Useful in multi-agent systems for identification

- **`includeAgentName`**: `"inline" | undefined`

  - Controls how agent name appears in responses
  - `"inline"`: Adds XML-style tags like `<name>agent_name</name><content>response</content>`
  - `undefined`: Uses LLM provider's native name support (OpenAI only)

- **`preModelHook`**: `RunnableLike<State, Update, LangGraphRunnableConfig>`

  - Runnable executed before the agent node (LLM call)
  - Useful for message trimming, preprocessing, summarization
  - Receives full state and can modify it before LLM processing

- **`postModelHook`**: `RunnableLike<State, Update, LangGraphRunnableConfig>`
  - Runnable executed after the agent node (LLM call)
  - Useful for validation, guardrails, human-in-the-loop workflows
  - Receives state with the agent's response

#### Returns

```typescript
CompiledStateGraph<
  State,
  Update,
  any,
  MessagesAnnotation.spec & StateSpec,
  AgentState.spec & StateSpec
>;
```

Read more about LangGraph's StateGraph in the [LangGraph documentation](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html).

## Examples

Check out the [examples directory](../../examples/src/agents/) for more comprehensive examples and use cases.

## Contributing

This package is part of the LangChain.js project. For contribution guidelines, please see the [main repository](../../CONTRIBUTING.md).

## License

This package is licensed under the MIT License.
