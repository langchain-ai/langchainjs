# 🦜🕸️LangGraph.js

⚡ Building language agents as graphs ⚡

## Overview

LangGraph is a library for building stateful, multi-actor applications with LLMs, built on top of (and intended to be used with) [LangChain.js](https://github.com/langchain-ai/langchainjs). 
It extends the [LangChain Expression Language](https://js.langchain.com/docs/expression_language/) with the ability to coordinate multiple chains (or actors) across multiple steps of computation in a cyclic manner. 
It is inspired by [Pregel](https://research.google/pubs/pub37252/) and [Apache Beam](https://beam.apache.org/).
The current interface exposed is one inspired by [NetworkX](https://networkx.org/documentation/latest/).

The main use is for adding **cycles** to your LLM application.
Crucially, LangGraph is NOT optimized for only **DAG** workflows.
If you want to build a DAG, you should use just use [LangChain Expression Language](https://js.langchain.com/docs/expression_language/).

Cycles are important for agent-like behaviors, where you call an LLM in a loop, asking it what action to take next.

> Looking for the Python version? Click [here](https://github.com/langchain-ai/langgraph).

## Installation

```bash
npm install @langchain/langgraph
```

## Quick start

One of the central concepts of LangGraph is state. Each graph execution creates a state that is passed between nodes in the graph as they execute, and each node updates this internal state with its return value after it executes. The way that the graph updates its internal state is defined by either the type of graph chosen or a custom function.

State in LangGraph can be pretty general, but to keep things simpler to start, we'll show off an example where the graph's state is limited to a list of chat messages using the built-in `MessageGraph` class. This is convenient when using LangGraph with LangChain chat models because we can return chat model output directly.

First, install the LangChain OpenAI integration package:

```shell
npm i @langchain/openai
```

We also need to export some environment variables:

```shell
export OPENAI_API_KEY=sk-...
```

And now we're ready! The graph below contains a single node called `"oracle"` that executes a chat model, then returns the result:

```ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, BaseMessage, } from "@langchain/core/messages";
import { END, MessageGraph } from "@langchain/langgraph";

const model = new ChatOpenAI({ temperature: 0 });

const graph = new MessageGraph();

graph.addNode("oracle", async (state: BaseMessage[]) => {
  return model.invoke(state);
});

graph.addEdge("oracle", END);

graph.setEntryPoint("oracle");

const runnable = graph.compile();
```

Let's run it!

```ts
// For Message graph, input should always be a message or list of messages.
const res = await runnable.invoke(
  new HumanMessage("What is 1 + 1?")
);
```

```ts
[
  HumanMessage {
    content: 'What is 1 + 1?',
    additional_kwargs: {}
  },
  AIMessage {
    content: '1 + 1 equals 2.',
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
]
```

So what did we do here? Let's break it down step by step:

1. First, we initialize our model and a `MessageGraph`.
2. Next, we add a single node to the graph, called `"oracle"`, which simply calls the model with the given input.
3. We add an edge from this `"oracle"` node to the special value `END`. This means that execution will end after current node.
4. We set `"oracle"` as the entrypoint to the graph.
5. We compile the graph, ensuring that no more modifications to it can be made.

Then, when we execute the graph:

1. LangGraph adds the input message to the internal state, then passes the state to the entrypoint node, `"oracle"`.
2. The `"oracle"` node executes, invoking the chat model.
3. The chat model returns an `AIMessage`. LangGraph adds this to the state.
4. Execution progresses to the special `END` value and outputs the final state.

And as a result, we get a list of two chat messages as output.

### Interaction with LCEL

As an aside for those already familiar with LangChain - `addNode` actually takes any runnable as input. In the above example, the passed function is automatically converted, but we could also have passed the model directly:

```ts
graph.addNode("oracle", model);
```

In which case the `.invoke()` method will be called when the graph executes.

Just make sure you are mindful of the fact that the input to the runnable is the entire current state. So this will fail:

```ts
// This will NOT work with MessageGraph!
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant who always speaks in pirate dialect"],
    MessagesPlaceholder("messages"),
]);

const chain = prompt.pipe(model);

// State is a list of messages, but our chain expects an object input:
//
// { messages: [] }
//
// Therefore, the graph will throw an exception when it executes here.
graph.addNode("oracle", chain);
```

## Conditional edges

Now, let's move onto something a little bit less trivial. Because math can be difficult for LLMs, let's allow the LLM to conditionally call a calculator node using tool calling.

```bash
npm i langchain @langchain/openai
```

We'll recreate our graph with an additional `"calculator"` that will take the result of the most recent message, if it is a math expression, and calculate the result.
We'll also bind the calculator to the OpenAI model as a tool to allow the model to optionally use the tool if it deems necessary:

```ts
import {
  ToolMessage,
} from "@langchain/core/messages";
import { Calculator } from "langchain/tools/calculator";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

const model = new ChatOpenAI({
  temperature: 0,
}).bind({
  tools: [convertToOpenAITool(new Calculator())],
  tool_choice: "auto",
});

const graph = new MessageGraph();

graph.addNode("oracle", async (state: BaseMessage[]) => {
  return model.invoke(state);
});

graph.addNode("calculator", async (state: BaseMessage[]) => {
  const tool = new Calculator();
  const toolCalls =
    state[state.length - 1].additional_kwargs.tool_calls ?? [];
  const calculatorCall = toolCalls.find(
    (toolCall) => toolCall.function.name === "calculator"
  );
  if (calculatorCall === undefined) {
    throw new Error("No calculator input found.");
  }
  const result = await tool.invoke(
    JSON.parse(calculatorCall.function.arguments)
  );
  return new ToolMessage({
    tool_call_id: calculatorCall.id,
    content: result,
  });
});

graph.addEdge("calculator", END);

graph.setEntryPoint("oracle");
```

Now let's think - what do we want to have happen?

- If the `"oracle"` node returns a message expecting a tool call, we want to execute the `"calculator"` node
- If not, we can just end execution

We can achieve this using **conditional edges**, which routes execution to a node based on the current state using a function.

Here's what that looks like:

```ts
const router = (state: BaseMessage[]) => {
  const toolCalls =
    state[state.length - 1].additional_kwargs.tool_calls ?? [];
  if (toolCalls.length) {
    return "calculator";
  } else {
    return "end";
  }
};

graph.addConditionalEdges("oracle", router, {
  calculator: "calculator",
  end: END,
});
```

If the model output contains a tool call, we move to the `"calculator"` node. Otherwise, we end.

Great! Now all that's left is to compile the graph and try it out. Math-related questions are routed to the calculator tool:

```ts
const runnable = graph.compile();
const mathResponse = await runnable.invoke(new HumanMessage("What is 1 + 1?"));
```

```ts
[
  HumanMessage {
    content: 'What is 1 + 1?',
    additional_kwargs: {}
  },
  AIMessage {
    content: '',
    additional_kwargs: { function_call: undefined, tool_calls: [Array] }
  },
  ToolMessage {
    content: '2',
    name: undefined,
    additional_kwargs: {},
    tool_call_id: 'call_P7KWQoftVsj6fgsqKyolWp91'
  }
]
```

While conversational responses are outputted directly:

```ts
const otherResponse = await runnable.invoke(new HumanMessage("What is your name?"));
```

```ts
[
  HumanMessage {
    content: 'What is your name?',
    additional_kwargs: {}
  },
  AIMessage {
    content: 'My name is Assistant. How can I assist you today?',
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
]
```

## Cycles

Now, let's go over a more general example with a cycle. We will recreate the [`AgentExecutor`](https://js.langchain.com/docs/modules/agents/concepts#agentexecutor) class from LangChain.

The benefits of creating it with LangGraph is that it is more modifiable.

We will need to install some LangChain packages:

```shell
npm install langchain @langchain/core @langchain/community @langchain/openai
```

We also need additional environment variables.

```shell
export OPENAI_API_KEY=sk-...
export TAVILY_API_KEY=tvly-...
```

Optionally, we can set up [LangSmith](https://docs.smith.langchain.com/) for best-in-class observability.

```shell
export LANGCHAIN_TRACING_V2="true"
export LANGCHAIN_API_KEY=ls__...
export LANGCHAIN_ENDPOINT=https://api.langchain.com
```

### Set up the tools

As above, we will first define the tools we want to use.
For this simple example, we will use a built-in search tool via Tavily.
However, it is really easy to create your own tools - see documentation [here](https://js.langchain.com/docs/modules/agents/tools/dynamic) on how to do that.

```typescript
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const tools = [new TavilySearchResults({ maxResults: 1 })];
```

We can now wrap these tools in a ToolExecutor, which simply takes in a ToolInvocation and calls that tool, returning the output.

A ToolInvocation is any type with `tool` and `toolInput` attribute.


```typescript
import { ToolExecutor } from "@langchain/langgraph/prebuilt";

const toolExecutor = new ToolExecutor({ tools });
```

### Set up the model

Now we need to load the chat model we want to use.
This time, we'll use the older function calling interface. This walkthrough will use OpenAI, but we can choose any model that supports OpenAI function calling.

```typescript
import { ChatOpenAI } from "@langchain/openai";

// We will set streaming: true so that we can stream tokens
// See the streaming section for more information on this.
const model = new ChatOpenAI({
  temperature: 0,
  streaming: true
});
```

After we've done this, we should make sure the model knows that it has these tools available to call.
We can do this by converting the LangChain tools into the format for OpenAI function calling, and then bind them to the model class.

```typescript
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

const toolsAsOpenAIFunctions = tools.map((tool) =>
  convertToOpenAIFunction(tool)
);
const newModel = model.bind({
  functions: toolsAsOpenAIFunctions,
});
```

### Define the agent state

This time, we'll use the more general `StateGraph`.
This graph is parameterized by a state object that it passes around to each node.
Remember that each node then returns operations to update that state.
These operations can either SET specific attributes on the state (e.g. overwrite the existing values) or ADD to the existing attribute.
Whether to set or add is denoted by annotating the state object you construct the graph with.

For this example, the state we will track will just be a list of messages.
We want each node to just add messages to that list.
Therefore, we will use an object with one key (`messages`) with the value as an object: `{ value: Function, default?: () => any }`

The `default` key must be a factory that returns the default value for that attribute.

```typescript
import { BaseMessage } from "@langchain/core/messages";

const agentState = {
  messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }
};
```

You can think of the `MessageGraph` used in the initial example as a preconfigured version of this graph. The difference is that the state is directly a list of messages,
instead of an object containing a key called `"messages"` whose value is a list of messages.
The `MessageGraph` update step is similar to the one above where we always append the returned values of a node to the internal state.

### Define the nodes

We now need to define a few different nodes in our graph.
In LangGraph, a node can be either a function or a [runnable](https://js.langchain.com/docs/expression_language/).
There are two main nodes we need for this:

1. The agent: responsible for deciding what (if any) actions to take.
2. A function to invoke tools: if the agent decides to take an action, this node will then execute that action.

We will also need to define some edges.
Some of these edges may be conditional.
The reason they are conditional is that based on the output of a node, one of several paths may be taken.
The path that is taken is not known until that node is run (the LLM decides).

1. Conditional Edge: after the agent is called, we should either:
   a. If the agent said to take an action, then the function to invoke tools should be called
   b. If the agent said that it was finished, then it should finish
2. Normal Edge: after the tools are invoked, it should always go back to the agent to decide what to do next

Let's define the nodes, as well as a function to decide how what conditional edge to take.

```typescript
import { FunctionMessage } from "@langchain/core/messages";
import { AgentAction } from "@langchain/core/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder
} from "@langchain/core/prompts";

// Define the function that determines whether to continue or not
const shouldContinue = (state: { messages: Array<BaseMessage> }) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  // If there is no function call, then we finish
  if (
    !("function_call" in lastMessage.additional_kwargs) ||
    !lastMessage.additional_kwargs.function_call
  ) {
    return "end";
  }
  // Otherwise if there is, we continue
  return "continue";
};

// Define the function to execute tools
const _getAction = (state: { messages: Array<BaseMessage> }): AgentAction => {
  const { messages } = state;
  // Based on the continue condition
  // we know the last message involves a function call
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    throw new Error("No messages found.");
  }
  if (!lastMessage.additional_kwargs.function_call) {
    throw new Error("No function call found in message.");
  }
  // We construct an AgentAction from the function_call
  return {
    tool: lastMessage.additional_kwargs.function_call.name,
    toolInput: JSON.parse(
      lastMessage.additional_kwargs.function_call.arguments
    ),
    log: "",
  };
};

// Define the function that calls the model
const callModel = async (
  state: { messages: Array<BaseMessage> }
) => {
  const { messages } = state;
  // You can use a prompt here to tweak model behavior.
  // You can also just pass messages to the model directly.
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant."],
    new MessagesPlaceholder("messages"),
  ]);
  const response = await prompt
    .pipe(newModel)
    .invoke({ messages });
  // We return a list, because this will get added to the existing list
  return {
    messages: [response],
  };
};

const callTool = async (
  state: { messages: Array<BaseMessage> }
) => {
  const action = _getAction(state);
  // We call the tool_executor and get back a response
  const response = await toolExecutor.invoke(action);
  // We use the response to create a FunctionMessage
  const functionMessage = new FunctionMessage({
    content: response,
    name: action.tool,
  });
  // We return a list, because this will get added to the existing list
  return { messages: [functionMessage] };
};
```

### Define the graph

We can now put it all together and define the graph!

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { RunnableLambda } from "@langchain/core/runnables";

// Define a new graph
const workflow = new StateGraph({
  channels: agentState,
});

// Define the two nodes we will cycle between
workflow.addNode("agent", callModel);
workflow.addNode("action", callTool);

// Set the entrypoint as `agent`
// This means that this node is the first one called
workflow.setEntryPoint("agent");

// We now add a conditional edge
workflow.addConditionalEdges(
  // First, we define the start node. We use `agent`.
  // This means these are the edges taken after the `agent` node is called.
  "agent",
  // Next, we pass in the function that will determine which node is called next.
  shouldContinue,
  // Finally we pass in a mapping.
  // The keys are strings, and the values are other nodes.
  // END is a special node marking that the graph should finish.
  // What will happen is we will call `should_continue`, and then the output of that
  // will be matched against the keys in this mapping.
  // Based on which one it matches, that node will then be called.
  {
    // If `tools`, then we call the tool node.
    continue: "action",
    // Otherwise we finish.
    end: END
  }
);

// We now add a normal edge from `tools` to `agent`.
// This means that after `tools` is called, `agent` node is called next.
workflow.addEdge("action", "agent");

// Finally, we compile it!
// This compiles it into a LangChain Runnable,
// meaning you can use it as you would any other runnable
const app = workflow.compile();
```

### Use it!

We can now use it!
This now exposes the [same interface](https://js.langchain.com/docs/expression_language/) as all other LangChain runnables.
This runnable accepts a list of messages.

```typescript
import { HumanMessage } from "@langchain/core/messages";

const inputs = {
  messages: [new HumanMessage("what is the weather in sf")]
}
const result = await app.invoke(inputs);
```

See a LangSmith trace of this run [here](https://smith.langchain.com/public/144af8a3-b496-43aa-ba9d-f0d5894196e2/r).

This may take a little bit - it's making a few calls behind the scenes.
In order to start seeing some intermediate results as they happen, we can use streaming - see below for more information on that.

## Streaming

LangGraph has support for several different types of streaming.

### Streaming Node Output

One of the benefits of using LangGraph is that it is easy to stream output as it's produced by each node.

```typescript
const inputs = {
  messages: [new HumanMessage("what is the weather in sf")]
};
for await (const output of await app.stream(inputs)) {
  console.log("output", output);
  console.log("-----\n");
}
```

See a LangSmith trace of this run [here](https://smith.langchain.com/public/968cd1bf-0db2-410f-a5b4-0e73066cf06e/r).

## Running Examples

You can find some more example notebooks of different use-cases in the `examples/` folder in this repo. These example notebooks use the [Deno runtime](https://deno.land/).

To pull in environment variables, you can create a `.env` file at the **root** of this repo (not in the `examples/` folder itself).

## When to Use

When should you use this versus [LangChain Expression Language](https://js.langchain.com/docs/expression_language/)?

If you need cycles.

Langchain Expression Language allows you to easily define chains (DAGs) but does not have a good mechanism for adding in cycles.
`langgraph` adds that syntax.

## Examples

### ChatAgentExecutor: with function calling

This agent executor takes a list of messages as input and outputs a list of messages. 
All agent state is represented as a list of messages.
This specifically uses OpenAI function calling.
This is recommended agent executor for newer chat based models that support function calling.

- [Getting Started Notebook](/examples/chat_agent_executor_with_function_calling/base.ipynb): Walks through creating this type of executor from scratch

### AgentExecutor

This agent executor uses existing LangChain agents.

- [Getting Started Notebook](/examples/agent_executor/base.ipynb): Walks through creating this type of executor from scratch

### Multi-agent Examples

- [Multi-agent collaboration](/examples/multi_agent/multi_agent_collaboration.ipynb): how to create two agents that work together to accomplish a task
- [Multi-agent with supervisor](/examples/multi_agent/agent_supervisor.ipynb): how to orchestrate individual agents by using an LLM as a "supervisor" to distribute work
- [Hierarchical agent teams](/examples/multi_agent/hierarchical_agent_teams.ipynb): how to orchestrate "teams" of agents as nested graphs that can collaborate to solve a problem

## Documentation

There are only a few new APIs to use.

### StateGraph

The main entrypoint is `StateGraph`.

```typescript
import { StateGraph } from "@langchain/langgraph";
```

This class is responsible for constructing the graph.
It exposes an interface inspired by [NetworkX](https://networkx.org/documentation/latest/).
This graph is parameterized by a state object that it passes around to each node.


#### `constructor`

```typescript
interface StateGraphArgs<T = any> {
  channels: Record<
    string,
    {
      value: BinaryOperator<T> | null;
      default?: () => T;
    }
  >;
}

class StateGraph<T> extends Graph {
  constructor(fields: StateGraphArgs<T>) {}
```

When constructing the graph, you need to pass in a schema for a state.
Each node then returns operations to update that state.
These operations can either SET specific attributes on the state (e.g. overwrite the existing values) or ADD to the existing attribute.
Whether to set or add is denoted by annotating the state object you construct the graph with.


Let's take a look at an example:

```typescript
import { BaseMessage } from "@langchain/core/messages";

const schema = {
  input: {
    value: null,
  },
  agentOutcome: {
    value: null,
  },
  steps: {
    value: (x: Array<BaseMessage>, y: Array<BaseMessage>) => x.concat(y),
    default: () => [],
  },
};
```

We can then use this like:

```typescript
// Initialize the StateGraph with this state
const graph = new StateGraph({ channels: schema })
// Create nodes and edges
...
// Compile the graph
const app = graph.compile()

// The inputs should be an object, because the schema is an object
const inputs = {
   // Let's assume this the input
   input: "hi"
   // Let's assume agent_outcome is set by the graph as some point
   // It doesn't need to be provided, and it will be null by default
}
```

### `.addNode`

```typescript
addNode(key: string, action: RunnableLike<RunInput, RunOutput>): void
```

This method adds a node to the graph.
It takes two arguments:

- `key`: A string representing the name of the node. This must be unique.
- `action`: The action to take when this node is called. This should either be a function or a runnable.

### `.addEdge`

```typescript
addEdge(startKey: string, endKey: string): void
```

Creates an edge from one node to the next.
This means that output of the first node will be passed to the next node.
It takes two arguments.

- `startKey`: A string representing the name of the start node. This key must have already been registered in the graph.
- `endKey`: A string representing the name of the end node. This key must have already been registered in the graph.

### `.addConditionalEdges`

```typescript
addConditionalEdges(
  startKey: string,
  condition: CallableFunction,
  conditionalEdgeMapping: Record<string, string>
): void
```

This method adds conditional edges.
What this means is that only one of the downstream edges will be taken, and which one that is depends on the results of the start node.
This takes three arguments:

- `startKey`: A string representing the name of the start node. This key must have already been registered in the graph.
- `condition`: A function to call to decide what to do next. The input will be the output of the start node. It should return a string that is present in `conditionalEdgeMapping` and represents the edge to take.
- `conditionalEdgeMapping`: A mapping of string to string. The keys should be strings that may be returned by `condition`. The values should be the downstream node to call if that condition is returned.

### `.setEntryPoint`

```typescript
setEntryPoint(key: string): void
```

The entrypoint to the graph.
This is the node that is first called.
It only takes one argument:

- `key`: The name of the node that should be called first.

### `.setFinishPoint`

```typescript
setFinishPoint(key: string): void
```

This is the exit point of the graph.
When this node is called, the results will be the final result from the graph.
It only has one argument:

- `key`: The name of the node that, when called, will return the results of calling it as the final output

Note: This does not need to be called if at any point you previously created an edge (conditional or normal) to `END`

### `END`

```typescript
import { END } from "@langchain/langgraph";
```

This is a special node representing the end of the graph.
This means that anything passed to this node will be the final output of the graph.
It can be used in two places:

- As the `endKey` in `addEdge`
- As a value in `conditionalEdgeMapping` as passed to `addConditionalEdges`

## When to Use

When should you use this versus [LangChain Expression Language](https://js.langchain.com/docs/expression_language/)?

If you need cycles.

Langchain Expression Language allows you to easily define chains (DAGs) but does not have a good mechanism for adding in cycles.
`langgraph` adds that syntax.

## Examples

### AgentExecutor

See the above Quick Start for an example of re-creating the LangChain [`AgentExecutor`](https://js.langchain.com/docs/modules/agents/concepts#agentexecutor) class.

### Forced Function Calling

One simple modification of the above Graph is to modify it such that a certain tool is always called first.
This can be useful if you want to enforce a certain tool is called, but still want to enable agentic behavior after the fact.

Assuming you have done the above Quick Start, you can build off it like:

#### Define the first tool call

Here, we manually define the first tool call that we will make.
Notice that it does that same thing as `agent` would have done (adds the `agentOutcome` key).
This is so that we can easily plug it in.

```typescript
import { AgentStep, AgentAction, AgentFinish } from "@langchain/core/agents";

// Define the data type that the agent will return.
type AgentData = {
  input: string;
  steps: Array<AgentStep>;
  agentOutcome?: AgentAction | AgentFinish;
};

const firstAgent = (inputs: AgentData) => {
  const newInputs = inputs;
  const action = {
    // We force call this tool
    tool: "tavily_search_results_json",
    // We just pass in the `input` key to this tool
    toolInput: newInputs.input,
    log: ""
  };
  newInputs.agentOutcome = action;
  return newInputs;
};
```

#### Create the graph

We can now create a new graph with this new node

```typescript
const workflow = new Graph();

// Add the same nodes as before, plus this "first agent"
workflow.addNode("firstAgent", firstAgent);
workflow.addNode("agent", agent);
workflow.addNode("tools", executeTools);

// We now set the entry point to be this first agent
workflow.setEntryPoint("firstAgent");

// We define the same edges as before
workflow.addConditionalEdges("agent", shouldContinue, {
  continue: "tools",
  exit: END
});
workflow.addEdge("tools", "agent");

// We also define a new edge, from the "first agent" to the tools node
// This is so that we can call the tool
workflow.addEdge("firstAgent", "tools");

// We now compile the graph as before
const chain = workflow.compile();
```

#### Use it!

We can now use it as before!
Depending on whether or not the first tool call is actually useful, this may save you an LLM call or two.

```typescript
const result = await chain.invoke({
  input: "what is the weather in sf",
  steps: []
});
```

You can see a LangSmith trace of this chain [here](https://smith.langchain.com/public/2e0a089f-8c05-405a-8404-b0a60b79a84a/r).
