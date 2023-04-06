# Motörhead Memory

[Motörhead](https://github.com/getmetal/motorhead) is a memory server implemented in Rust. It automatically handles incremental summarization in the background and allows for stateless applications.

## Setup

See instructions at [Motörhead](https://github.com/getmetal/motorhead) for running the server locally.

## Usage

```typescript
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import { MotorheadMemory } from "langchain/memory";

const model = new ChatOpenAI({});
const memory = new MotorheadMemory({
  sessionId: "user-id",
  motorheadUrl: "localhost:8080",
});

await memory.init(); // loads previous state from Motörhead 🤘
const context = memory.context
  ? `
Here's previous context: ${memory.context}`
  : "";

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.${context}`
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const chain = new ConversationChain({
  memory,
  prompt: chatPrompt,
  llm: chat,
});

const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log({ res1 });
```

```shell
{response: " Hi Jim! It's nice to meet you. My name is AI. What would you like to talk about?"}
```

```typescript
const res2 = await chain.call({ input: "What's my name?" });
console.log({ res2 });
```

```shell
{response: ' You said your name is Jim. Is there anything else you would like to talk about?'}
```
