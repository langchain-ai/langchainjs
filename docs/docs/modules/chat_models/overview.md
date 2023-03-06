---
sidebar_position: 1
sidebar_label: Overview
---

# Chat Models

Chat models are a variation on language models.
While chat models use language models under the hood, the interface they expose is a bit different.
Rather than expose a "text in, text out" API, they expose an interface where "chat messages" are the inputs and outputs.

Chat model APIs are fairly new, so we are still figuring out the correct abstractions.

## Getting Started

This section covers how to get started with chat models. The interface is based around messages rather than raw text.

```typescript
import { ChatOpenAI } from "langchain/chat_models";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

const chat = new ChatOpenAI({ temperature: 0 });
```

You can get chat completions by passing one or more messages to the chat model. The response will be a message. The types of messages currently supported in LangChain are `AIChatMessage`, `HumanChatMessage`, `SystemChatMessage`, and a generic `ChatMessage` -- ChatMessage takes in an arbitrary role parameter. Most of the time, you'll just be dealing with `HumanChatMessage`, `AIChatMessage`, and `SystemChatMessage`.

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

OpenAI's chat model supports multiple messages as input. See [here](https://platform.openai.com/docs/guides/chat/chat-vs-completions) for more information. Here is an example of sending a system and user message to the chat model:

```typescript
response = await chat.call([
  new SystemChatMessage(
    "You are a helpful assistant that translates English to French."
  ),
  new HumanChatMessage(
    "Translate this sentence from English to French. I love programming."
  ),
]);

console.log(response);
```

```
AIChatMessage { text: "J'aime programmer." }
```

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

## PromptTemplates

You can make use of templating by using a `MessagePromptTemplate`. You can build a `ChatPromptTemplate` from one or more `MessagePromptTemplates`. You can use `ChatPromptTemplate`'s format_prompt -- this returns a `PromptValue`, which you can convert to a string or Message object, depending on whether you want to use the formatted value as input to an llm or chat model.

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
const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  ),
  HumanMessagePromptTemplate.fromTemplate("{text}"),
]);
```

Then we can use the template to generate a response:

```typescript
const responseA = await chat.generatePrompt([
  await chatPrompt.formatPromptValue({
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

## LLMChain

You can use the existing LLMChain in a very similar way to before - provide a prompt and a model.

```typescript
const chain = new LLMChain({
  prompt: chatPrompt,
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

## Streaming

You can also use the streaming API to get words streamed back to you as they are generated. This is useful for eg. chatbots, where you want to show the user what is being generated as it is being generated.

```typescript
const chatStreaming = new ChatOpenAI({
  streaming: true,
  callbackManager: {
    handleNewToken(token) {
      console.log(token);
    },
  },
});

const responseD = await chatStreaming.call([
  new HumanChatMessage("Write me a song about sparkling water."),
]);
```

```
Verse 1:
Bubbles in the bottle,
Light and refreshing,
It's the drink that I love,
My thirst quenching blessing.

Chorus:
Sparkling water, my fountain of youth,
I can't get enough, it's the perfect truth,
It's fizzy and fun, and oh so clear,
Sparkling water, it's crystal clear.

Verse 2:
No calories or sugars,
Just a burst of delight,
It's the perfect cooler,
On a hot summer night.

Chorus:
Sparkling water, my fountain of youth,
I can't get enough, it's the perfect truth,
It's fizzy and fun, and oh so clear,
Sparkling water, it's crystal clear.

Bridge:
It's my happy place,
In every situation,
My daily dose of hydration,
Always bringing satisfaction.

Chorus:
Sparkling water, my fountain of youth,
I can't get enough, it's the perfect truth,
It's fizzy and fun, and oh so clear,
Sparkling water, it's crystal clear.

Outro:
Sparkling water, it's crystal clear,
My love for you will never disappear.
```
