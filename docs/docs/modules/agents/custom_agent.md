# Custom Agent

The first way to create a custom agent is to use an existing Agent class, but use a custom LLMChain. This is the simplest way to create a custom Agent. It is highly reccomended that you work with the ZeroShotAgent, as at the moment that is by far the most generalizable one.

Most of the work in creating the custom LLMChain comes down to the prompt. Because we are using an existing agent class to parse the output, it is very important that the prompt say to produce text in that format. Additionally, we currently require an agent_scratchpad input variable to put notes on previous actions and observations. This should almost always be the final part of the prompt. However, besides those instructions, you can customize the prompt as you wish.

To ensure that the prompt contains the appropriate instructions, we will utilize a helper method on that class. The helper method for the ZeroShotAgent takes the following arguments:

- tools: List of tools the agent will have access to, used to format the prompt.
- prefix: String to put before the list of tools.
- suffix: String to put after the list of tools.
- input_variables: List of input variables the final prompt will expect.

For this exercise, we will give our agent access to Google Search and a Calcuator, and we will customize it in that we will have it answer as a pirate.

First, let's import what we need.

```typescript
import { OpenAI } from "langchain/llms";
import { ZeroShotAgent, AgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator } from "langchain/tools";
import { LLMChain } from "langchain/chains";
```

Next, let's initialize a model and the tools we want.

```typescript
const model = new OpenAI({ temperature: 0 });
const tools = [new SerpAPI(), new Calculator()];
```

Now, let's create the custom prompt.

```typescript
const prefix = `Answer the following questions as best you can, but speaking as a pirate might speak. You have access to the following tools:`;
const suffix = `Begin! Remember to speak as a pirate when giving your final answer. Use lots of "Args"

Question: {input}
{agent_scratchpad}`;

const createPromptArgs = {
  suffix,
  prefix,
  inputVariables: ["input", "agent_scratchpad"],
};

const prompt = ZeroShotAgent.createPrompt(tools, createPromptArgs);

console.log(prompt.template);
```

Now, lets create an LLMChain with that custom prompt.

```typescript
const llmChain = new LLMChain({ llm: model, prompt });
```

Now we create an agent and agent executor with that custom prompt.

```typescript
const agent = new ZeroShotAgent({
  llmChain: llmChain,
  allowedTools: ["search", "calculator"],
});
const agentExecutor = AgentExecutor.fromAgentAndTools({ agent, tools });
console.log("Loaded agent.");
```

Now we can run the agent!

```typescript
const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

console.log(`Executing with input "${input}"...`);

const result = await agentExecutor.call({ input });

console.log(`Got output ${result.output}`);
```

```shell
Got output Arrr, Jason Sudeikis be 47 years old raised to the 0.23 power be 2.4242784855673896.
```
