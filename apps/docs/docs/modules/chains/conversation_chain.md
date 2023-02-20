# Conversation Chain

The conversation chain is prebuilt chain aimed at facilitating a chat bot experience.

See below for an example of how to run it.

```typescript
import { OpenAI } from "langchain/llms";
import { ConversationChain } from "langchain/chains";

const model = new OpenAI({});
const chain = new ConversationChain({ llm: model });
const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log({ res1 });
const res2 = await chain.call({ input: "What's my name?" });
console.log({ res2 });
```
