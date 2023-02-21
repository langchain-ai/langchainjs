# Agent Overview

Agents use an LLM to determine which actions to take and in what order. An action can either be using a tool and observing its output, or returning to the user.

When used correctly agents can be extremely powerful. In this tutorial, we show you how to easily use agents through the simplest, highest level API.

In order to load agents, you should understand the following concepts:

- Tool: A function that performs a specific duty. This can be things like: Google Search, Database lookup, code REPL, other chains. The interface for a tool is currently a function that is expected to have a string as an input, with a string as an output.
- LLM: The language model powering the agent.
- Agent: The agent to use. This should be a string that references a support agent class. Because this notebook focuses on the simplest, highest level API, this only covers using the standard supported agents.

For this example, you will also need to install the SerpAPI package for JavaScript/TypeScript.

```bash
npm i serpapi
```

And set the appropriate environment variables in the `.env` file.

```
SERPAPI_API_KEY="..."
```

Now we can get started!

```typescript
import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator } from "langchain/tools";

const model = new OpenAI({ temperature: 0 });
const tools = [new SerpAPI(), new Calculator()];

const executor = await initializeAgentExecutor(
  tools,
  model,
  "zero-shot-react-description"
);
console.log("Loaded agent.");

const input =
  "Who is Olivia Wilde's boyfriend?" +
  " What is his current age raised to the 0.23 power?";
console.log(`Executing with input "${input}"...`);

const result = await executor.call({ input });

console.log(`Got output ${result.output}`);
```

```shell
langchain-examples:start: Executing with input "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?"...
langchain-examples:start: Got output Olivia Wilde's boyfriend is Jason Sudeikis, and his current age raised to the 0.23 power is 2.4242784855673896.
```
