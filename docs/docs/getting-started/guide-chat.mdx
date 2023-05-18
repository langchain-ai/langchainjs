---
sidebar_position: 3
---

import CodeBlock from "@theme/CodeBlock";
import Example from "@examples/models/chat/chat_streaming_stdout.ts";

# Quickstart, using Chat Models

Chat models are a variation on language models.
While chat models use language models under the hood, the interface they expose is a bit different.
Rather than expose a "text in, text out" API, they expose an interface where "chat messages" are the inputs and outputs.

Chat model APIs are fairly new, so we are still figuring out the correct abstractions.

## Installation and Setup

To get started, follow the [installation instructions](./install) to install LangChain.

## Getting Started

This section covers how to get started with chat models. The interface is based around messages rather than raw text.

```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

const chat = new ChatOpenAI({ temperature: 0 });
```

Here we create a chat model using the API key stored in the environment variable `OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY` in case you are using Azure OpenAI. We'll be calling this chat model throughout this section.

> **&#9432;** Note, if you are using Azure OpenAI make sure to also set the environment variables `AZURE_OPENAI_API_INSTANCE_NAME`, `AZURE_OPENAI_API_DEPLOYMENT_NAME` and `AZURE_OPENAI_API_VERSION`.

### Chat Models: Message in, Message out

You can get chat completions by passing one or more messages to the chat model. The response will also be a message. The types of messages currently supported in LangChain are `AIChatMessage`, `HumanChatMessage`, `SystemChatMessage`, and a generic `ChatMessage` -- ChatMessage takes in an arbitrary role parameter, which we won't be using here. Most of the time, you'll just be dealing with `HumanChatMessage`, `AIChatMessage`, and `SystemChatMessage`.

```typescript
const response = await chat.call([
  new HumanChatMessage(
    "Translate this sentence from English to French. I love programming."
  ),
]);

console.log(response);
```

```
AIChatMessage { text: "J'aime programmer." }
```

#### Multiple Messages

OpenAI's chat-based models (currently `gpt-3.5-turbo` and `gpt-4` and in case of azure OpenAI `gpt-4-32k`) support multiple messages as input. See [here](https://platform.openai.com/docs/guides/chat/chat-vs-completions) for more information. Here is an example of sending a system and user message to the chat model:

> **&#9432;** Note, if you are using Azure OpenAI make sure to change the deployment name to the deployment for the model you choose.

```typescript
const responseB = await chat.call([
  new SystemChatMessage(
    "You are a helpful assistant that translates English to French."
  ),
  new HumanChatMessage("Translate: I love programming."),
]);

console.log(responseB);
```

```
AIChatMessage { text: "J'aime programmer." }
```

#### Multiple Completions

You can go one step further and generate completions for multiple sets of messages using generate. This returns an LLMResult with an additional message parameter.

```typescript
const responseC = await chat.generate([
  [
    new SystemChatMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanChatMessage(
      "Translate this sentence from English to French. I love programming."
    ),
  ],
  [
    new SystemChatMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanChatMessage(
      "Translate this sentence from English to French. I love artificial intelligence."
    ),
  ],
]);

console.log(responseC);
```

```
{
  generations: [
    [
      {
        text: "J'aime programmer.",
        message: AIChatMessage { text: "J'aime programmer." },
      }
    ],
    [
      {
        text: "J'aime l'intelligence artificielle.",
        message: AIChatMessage { text: "J'aime l'intelligence artificielle." }
      }
    ]
  ]
}
```

### Chat Prompt Templates: Manage Prompts for Chat Models

You can make use of templating by using a `MessagePromptTemplate`. You can build a `ChatPromptTemplate` from one or more `MessagePromptTemplates`. You can use `ChatPromptTemplate`'s `formatPromptValue` -- this returns a `PromptValue`, which you can convert to a string or Message object, depending on whether you want to use the formatted value as input to an llm or chat model.

Continuing with the previous example:

```typescript
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "langchain/prompts";
```

First we create a reusable template:

```typescript
const translationPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  ),
  HumanMessagePromptTemplate.fromTemplate("{text}"),
]);
```

Then we can use the template to generate a response:

```typescript
const responseA = await chat.generatePrompt([
  await translationPrompt.formatPromptValue({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  }),
]);

console.log(responseA);
```

```
{
  generations: [
    [
      {
        text: "J'aime programmer.",
        message: AIChatMessage { text: "J'aime programmer." }
      }
    ]
  ]
}
```

### Model + Prompt = LLMChain

This pattern of asking for the completion of a formatted prompt is quite common, so we introduce the next piece of the puzzle: LLMChain

```typescript
const chain = new LLMChain({
  prompt: translationPrompt,
  llm: chat,
});
```

Then you can call the chain:

```typescript
const responseB = await chain.call({
  input_language: "English",
  output_language: "French",
  text: "I love programming.",
});

console.log(responseB);
```

```
{ text: "J'aime programmer." }
```

### Agents: Dynamically Run Chains Based on User Input

Finally, we introduce Tools and Agents, which extend the model with other abilities, such as search, or a calculator.

A tool is a function that takes a string (such as a search query) and returns a string (such as a search result). They also have a name and description, which are used by the chat model to identify which tool it should call.

```typescript
class Tool {
  name: string;
  description: string;
  call(arg: string): Promise<string>;
}
```

An agent is a stateless wrapper around an agent prompt chain (such as MRKL) which takes care of formatting tools into the prompt, as well as parsing the responses obtained from the chat model.

```typescript
interface AgentStep {
  action: AgentAction;
  observation: string;
}

interface AgentAction {
  tool: string; // Tool.name
  toolInput: string; // Tool.call argument
}

interface AgentFinish {
  returnValues: object;
}

class Agent {
  plan(steps: AgentStep[], inputs: object): Promise<AgentAction | AgentFinish>;
}
```

To make agents more powerful we need to make them iterative, ie. call the model multiple times until they arrive at the final answer. That's the job of the AgentExecutor.

```typescript
class AgentExecutor {
  // a simplified implementation
  run(inputs: object) {
    const steps = [];
    while (true) {
      const step = await this.agent.plan(steps, inputs);
      if (step instanceof AgentFinish) {
        return step.returnValues;
      }
      steps.push(step);
    }
  }
}
```

And finally, we can use the AgentExecutor to run an agent:

```typescript
// Define the list of tools the agent can use
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
];
// Create the agent from the chat model and the tools
const agent = ChatAgent.fromLLMAndTools(new ChatOpenAI(), tools);
// Create an executor, which calls to the agent until an answer is found
const executor = AgentExecutor.fromAgentAndTools({ agent, tools });

const responseG = await executor.run(
  "How many people live in canada as of 2023?"
);

console.log(responseG);
```

```
38,626,704.
```

### Memory: Add State to Chains and Agents

You can also use the chain to store state. This is useful for eg. chatbots, where you want to keep track of the conversation history. MessagesPlaceholder is a special prompt template that will be replaced with the messages passed in each call.

```typescript
const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const chain = new ConversationChain({
  memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
  prompt: chatPrompt,
  llm: chat,
});
```

The chain will internally accumulate the messages sent to the model, and the ones received as output. Then it will inject the messages into the prompt on the next call. So you can call the chain a few times, and it remembers previous messages:

```typescript
const responseH = await chain.call({
  input: "hi from London, how are you doing today",
});

console.log(responseH);
```

```
{
  response: "Hello! As an AI language model, I don't have feelings, but I'm functioning properly and ready to assist you with any questions or tasks you may have. How can I help you today?"
}
```

```typescript
const responseI = await chain.call({
  input: "Do you know where I am?",
});

console.log(responseI);
```

```
{
  response: "Yes, you mentioned that you are from London. However, as an AI language model, I don't have access to your current location unless you provide me with that information."
}
```

## Streaming

You can also use the streaming API to get words streamed back to you as they are generated. This is useful for eg. chatbots, where you want to show the user what is being generated as it is being generated. Note: OpenAI as of this writing does not support `tokenUsage` reporting while streaming is enabled.

<CodeBlock language="typescript">{Example}</CodeBlock>
