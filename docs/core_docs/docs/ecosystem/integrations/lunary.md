# Lunary

This page covers how to use [Lunary](https://lunary.ai?utm_source=langchain&utm_medium=js&utm_campaign=docs) with LangChain.

## What is Lunary?

Lunary is an [open-source](https://github.com/lunary-ai/lunary) platform that provides observability (tracing, analytics, feedback tracking), prompt templates management and evaluation for AI apps.

<video controls width='100%' >
  <source src='https://lunary.ai/videos/demo-annotated.mp4'/>
</video>

## Installation

Start by installing the Lunary package in your project:

```bash
npm install lunary
```

## Setup

Create an account on [lunary.ai](https://lunary.ai?utm_source=langchain&utm_medium=js&utm_campaign=docs). Then, create an App and copy the associated `tracking id`.

Once you have it, set it as an environment variable in your `.env`:

```bash
LUNARY_APP_ID="..."

# Optional if you're self hosting:
# LUNARY_API_URL="..."
```

If you prefer not to use environment variables, you can set your app ID explictly like this:

```ts
import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";

const handler = new LunaryHandler({
  appId: "app ID",
  // verbose: true,
  // apiUrl: 'custom self hosting url'
});
```

You can now use the callback handler with LLM calls, chains and agents.

## Quick Start

```ts
import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";

const model = new ChatOpenAI({
  callbacks: [new LunaryHandler()],
});
```

## LangChain Agent Tracing

When tracing chains or agents, make sure to include the callback at the run level so that all sub LLM calls & chain runs are reported as well.

```ts
import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
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
    callbacks: [new LunaryHandler()],
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
    callbacks: [new LunaryHandler()],
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
  callbacks: [new LunaryHandler()],
});

await model.call("Hello", {
  tags: ["greeting"],
});
```

## Usage with custom agents

You can use the callback handler combined with the `lunary` module to track custom agents that partially use LangChain:

```ts
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";

import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import lunary from "lunary";

const chat = new ChatOpenAI({
  modelName: "gpt-4",
  callbacks: [new LunaryHandler()],
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
const translate = lunary.wrapAgent(TranslatorAgent);

// You can use .identify() on wrapped methods to track users
const res = await translate("Good morning").identify("user123");

console.log(res);
```

## Full documentation

You can find the full documentation of the Lunary LangChain integration [here](https://lunary.ai/docs/langchain?utm_source=langchain&utm_medium=js&utm_campaign=docs).

## Support

For any question or issue with integration you can reach out to the Lunary team via [email](mailto:vince@lunary.ai) or livechat on the website.
