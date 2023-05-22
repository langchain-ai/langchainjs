# Zep Memory

[Zep](https://github.com/getzep/zep) is a memory server that stores, summarizes, embeds, indexes, and enriches conversational AI chat histories, autonomous agent histories, document Q&A histories and exposes them via simple, low-latency APIs.

Key Features:

- Long-term memory persistence, with access to historical messages irrespective of your summarization strategy.
- Auto-summarization of memory messages based on a configurable message window. A series of summaries are stored, providing flexibility for future summarization strategies.
- Vector search over memories, with messages automatically embedded on creation.
- Auto-token counting of memories and summaries, allowing finer-grained control over prompt assembly.
- Python and JavaScript SDKs.

## Setup

See instructions at [Zep](https://github.com/getzep/zep) for running the server locally or through an automated hosting provider.

## Usage

```typescript
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import { ZepMemory } from "@getzep/zep-js";
import uuid;

const model = new ChatOpenAI({});
const memory = new ZepMemory({
  sessionId: uuid.uuid4(),
  url: "http://localhost:8000",
});

await memory.init(); // loads previous state from Zep
const context = memory.context
  ? `
Here's previous context: ${memory.context}`
  : "";

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.`
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const chain = new ConversationChain({
  memory,
  prompt: chatPrompt,
  llm: chat,
});

const responseH = await chain.call({ input: "hi from Vauxhall, London, how are you doing today" });
console.log({ responseH });
```

```shell
{response: "Hello! As an AI language model, I don't have feelings, but I'm functioning properly and ready to assist you with any questions or tasks you may have. How can I help you today?"}
```

```typescript
const responseI = await chain.call({ input: "Do you know where I am?" });
console.log({ resonseI });
```

```shell
{response: 'Yes, you mentioned that you are from Vauxhall, London. However, as an AI language model, I don't have access to your current location unless you provide me with that information.'}
```
