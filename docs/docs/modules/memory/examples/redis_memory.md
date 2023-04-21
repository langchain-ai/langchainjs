# Redis Memory

[Redis](https://redis.io/) is an in-memory database, useful for storing multiple different types of data.

## Setup

See instructions at [Redis](https://redis.io/docs/getting-started/) for running the server locally. There are also multiple providers who will manage Redis as a service.

## Usage

You will need to connect to Redis using the `createClient()` method from the built-in Redis library. You have full access to all the configuration options. Pass that client to the Memory module.

```typescript
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import { RedisMemory } from "langchain/memory";
import { createClient } from "redis";

const model = new ChatOpenAI({});
//Create your client and instantiate your Memory Storage
const client = createClient();
const memory = new RedisMemory(client, {
  sessionId: "user-id",
  redisUrl: "redis://localhost:6379",
});

//Instantiate any history from a prior session
await memory.loadMemoryVariables({})

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

### Settings

You have three settings:

- `sessionId`: String to store all conversations in the same key (Required)
- `memoryKey`: Defaults to history. This should match your `MessagesPlaceholder` in your prompt.
- `memoryTTL`: How long the memory will persist in Redis (Default: 300s)

You have one method:

- `loadMemoryVariables`: This will query your Redis instance and add the existing (non-expired) history to your chain.
