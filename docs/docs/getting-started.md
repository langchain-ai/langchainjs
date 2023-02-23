# Quickstart Guide

This tutorial gives you a quick walkthrough about building an end-to-end language model application with LangChain.

## Installation

To get started, install LangChain with the following command:

```bash
npm i langchain
```

## Picking up a LLM

Using LangChain will usually require integrations with one or more model providers, data stores, apis, etc.

For this example, we will be using OpenAI's APIs, so we will first need to install their SDK:

```bash
npm i openai
```

## Building a Language Model Application

Now that we have installed LangChain, we can start building our language model application.

LangChain provides many modules that can be used to build language model applications. Modules can be combined to create more complex applications, or be used individually for simple applications.

### LLMs: Get predictions from a language model

The most basic building block of LangChain is calling an LLM on some input. Let's walk through a simple example of how to do this. For this purpose, let's pretend we are building a service that generates a company name based on what the company makes.

In order to do this, we first need to import the LLM wrapper.

```typescript
import { OpenAI } from "langchain";
```

We will then need to set the environment variable for the OpenAI key. Three options here:

1. We can do this by setting the value in a `.env` file and use the [dotenv](https://github.com/motdotla/dotenv) package to read it.

```
OPENAI_API_KEY="..."
```

2. Or we can export the environment variable with the following command in your shell:

```bash
export OPENAI_API_KEY=sk-....
```

3. Or we can do it when initializing the wrapper along with other arguments. In this example, we probably want the outputs to be MORE random, so we'll initialize it with a HIGH temperature.

```typescript
const model = new OpenAI({ openAIApiKey: "sk-...", temperature: 0.9 });
```

Once we have initialized the wrapper, we can now call it on some input!

```typescript
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log(res);
```

```shell
{ res: '\n\nFantasy Sockery' }
```

### Prompt Templates: Manage prompts for LLMs

Calling an LLM is a great first step, but it's just the beginning. Normally when you use an LLM in an application, you are not sending user input directly to the LLM. Instead, you are probably taking user input and constructing a prompt, and then sending that to the LLM.

For example, in the previous example, the text we passed in was hardcoded to ask for a name for a company that made colorful socks. In this imaginary service, what we would want to do is take only the user input describing what the company does, and then format the prompt with that information.

This is easy to do with LangChain!

First lets define the prompt template:

```typescript
import { PromptTemplate } from "langchain/prompts";
const template = "What is a good name for a company that makes {product}?";
const prompt = new PromptTemplate({
  template: template,
  inputVariables: ["product"],
});
```

Let's now see how this works! We can call the `.format` method to format it.

```typescript
const res = prompt.format({ product: "colorful socks" });
console.log(res);
```

```shell
{ res: 'What is a good name for a company that makes colorful socks?' }
```

### Chains: Combine LLMs and prompts in multi-step workflows

Up until now, we've worked with the PromptTemplate and LLM primitives by themselves. But of course, a real application is not just one primitive, but rather a combination of them.

A chain in LangChain is made up of links, which can be either primitives like LLMs or other chains.

The most core type of chain is an LLMChain, which consists of a PromptTemplate and an LLM.

Extending the previous example, we can construct an LLMChain which takes user input, formats it with a PromptTemplate, and then passes the formatted response to an LLM.

```typescript
import { OpenAI } from "langchain/llms";
import { PromptTemplate } from "langchain/prompts";
const model = new OpenAI({ temperature: 0.9 });
const template = "What is a good name for a company that makes {product}?";
const prompt = new PromptTemplate({
  template: template,
  inputVariables: ["product"],
});
```

We can now create a very simple chain that will take user input, format the prompt with it, and then send it to the LLM:

```typescript
import { LLMChain } from "langchain/chains";

const chain = new LLMChain({ llm: model, prompt: prompt });
```

Now we can run that chain only specifying the product!

```typescript
const res = await chain.call({ product: "colorful socks" });
console.log(res);
```

```shell
{ res: { text: '\n\nColorfulCo Sockery.' } }
```

There we go! There's the first chain - an LLM Chain. This is one of the simpler types of chains, but understanding how it works will set you up well for working with more complex chains.

### Agents: Dynamically call chains based on user input

So far the chains we've looked at run in a predetermined order.

Agents no longer do: they use an LLM to determine which actions to take and in what order. An action can either be using a tool and observing its output, or returning to the user.

When used correctly agents can be extremely powerful. In this tutorial, we show you how to easily use agents through the simplest, highest level API.

In order to load agents, you should understand the following concepts:

- Tool: A function that performs a specific duty. This can be things like: Google Search, Database lookup, code REPL, other chains. The interface for a tool is currently a function that is expected to have a string as an input, with a string as an output.
- LLM: The language model powering the agent.
- Agent: The agent to use. This should be a string that references a support agent class. Because this tutorial focuses on the simplest, highest level API, this only covers using the standard supported agents.

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

### Memory: Add state to chains and agents

So far, all the chains and agents we've gone through have been stateless. But often, you may want a chain or agent to have some concept of "memory" so that it may remember information about its previous interactions. The clearest and simple example of this is when designing a chatbot - you want it to remember previous messages so it can use context from that to have a better conversation. This would be a type of "short-term memory". On the more complex side, you could imagine a chain/agent remembering key pieces of information over time - this would be a form of "long-term memory".

LangChain provides several specially created chains just for this purpose. This section walks through using one of those chains (the `ConversationChain`).

By default, the `ConversationChain` has a simple type of memory that remembers all previous inputs/outputs and adds them to the context that is passed. Let's take a look at using this chain.

```typescript
import { OpenAI } from "langchain/llms";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

const model = new OpenAI({});
const memory = new BufferMemory();
const chain = new ConversationChain({ llm: model, memory: memory });
const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log(res1);
```

```shell
{response: " Hi Jim! It's nice to meet you. My name is AI. What would you like to talk about?"}
```

```typescript
const res2 = await chain.call({ input: "What's my name?" });
console.log(res2);
```

```shell
{response: ' You said your name is Jim. Is there anything else you would like to talk about?'}
```
