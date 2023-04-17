# Buffer Window Memory

BufferWindowMemory keeps track of the back-and-forths in conversation, and then uses a window of size `k` to surface the last `k` back-and-forths to use as memory.

```typescript
import { OpenAI } from "langchain/llms/openai";
import { BufferWindowMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

const model = new OpenAI({});
const memory = new BufferWindowMemory({ k: 1 });
const chain = new ConversationChain({ llm: model, memory: memory });
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
