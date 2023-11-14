# LLMonitor

This page covers how to use [LLMonitor](https://llmonitor.com?utm_source=langchain&utm_medium=js&utm_campaign=docs) with LangChain.

## What is LLMonitor?

LLMonitor is an [open-source](https://github.com/llmonitor/llmonitor) observability and analytics platform that provides tracing, analytics, feedback tracking and way more for AI apps.

<video controls width='100%' >
  <source src='https://llmonitor.com/videos/demo-annotated.mp4'/>
</video>

## Installation

Start by installing the LLMonitor package in your project:

```bash
npm install llmonitor
```

## Setup

Create an account on [llmonitor.com](https://llmonitor.com?utm_source=langchain&utm_medium=js&utm_campaign=docs). Then, create an App and copy the associated `tracking id`.

Once you have it, set it as an environment variable in your `.env`:

```bash
LLMONITOR_APP_ID="..."

# Optional if you're self hosting:
# LLMONITOR_API_URL="..."
```

If you prefer not to use environment variables, you can set your app ID explictly like this:

```ts
import { LLMonitorHandler } from "langchain/callbacks/handlers/llmonitor";

const handler = new LLMonitorHandler({
  appId: "app ID",
  // verbose: true,
  // apiUrl: 'custom self hosting url'
});
```

You can now use the callback handler with LLM calls, chains and agents.

## Quick Start

```ts
import { LLMonitorHandler } from "langchain/callbacks/handlers/llmonitor";

const model = new ChatOpenAI({
  callbacks: [new LLMonitorHandler()],
});
```

## LangChain Agent Tracing

When tracing chains or agents, make sure to include the callback at the run level so that all sub LLM calls & chain runs are reported as well.

```ts
import { LLMonitorHandler } from "langchain/callbacks/handlers/llmonitor";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Calculator } from "langchain/tools/calculator";

const tools = [new Calculator()];
const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

const executor = await initializeAgentExecutorWithOptions(tools, chat, {
  agentType: "openai-functions",
});

const result = await executor.run(
  "What is the approximate result of 78 to the power of 5?",
  {
    callbacks: [new LLMonitorHandler()],
    metadata: { agentName: "SuperCalculator" },
  }
);
```

## Tracking users

You can track users by adding `userId` and `userProps` to the metadata of your calls:

```ts
const result = await executor.run(
  "What is the approximate result of 78 to the power of 5?",
  {
    callbacks: [new LLMonitorHandler()],
    metadata: {
      agentName: "SuperCalculator",
      userId: "user123",
      userProps: {
        name: "John Doe",
        email: "email@example.org",
      },
    },
  }
);
```

## Tagging calls

You can tag calls with `tags`:

```ts
const model = new ChatOpenAI({
  callbacks: [new LLMonitorHandler()],
});

await model.call("Hello", {
  tags: ["greeting"],
});
```

## Usage with custom agents

You can use the callback handler combined with the `llmonitor` module to track custom agents that partially use LangChain:

```ts
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";

import { LLMonitorHandler } from "langchain/callbacks/handlers/llmonitor";
import monitor from "llmonitor";

const chat = new ChatOpenAI({
  modelName: "gpt-4",
  callbacks: [new LLMonitorHandler()],
});

async function TranslatorAgent(query) {
  const res = await chat.call([
    new SystemMessage(
      "You are a translator agent that hides jokes in each translation."
    ),
    new HumanMessage(
      `Translate this sentence from English to French: ${query}`
    ),
  ]);

  return res.content;
}

// By wrapping the agent with wrapAgent, we automatically track all input, outputs and errors
// And tools and logs will be tied to the correct agent
const translate = monitor.wrapAgent(TranslatorAgent);

// You can use .identify() on wrapped methods to track users
const res = await translate("Good morning").identify("user123");

console.log(res);
```

## Support

For any question or issue with integration you can reach out to the LLMonitor team on [Discord](http://discord.com/invite/8PafSG58kK) or via [email](mailto:vince@llmonitor.com).
