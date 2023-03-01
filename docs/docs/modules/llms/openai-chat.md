# OpenAI Chat

This guide goes through how to use the OpenAI Chat LLM wrapper. This is designed to use the ChatGPT family of models from OpenAI. You can find more information on them [here](https://platform.openai.com/docs/guides/chat).

```typescript
import { OpenAIChat } from "langchain/llms";

const model = new OpenAIChat({ modelName: "gpt-3.5-turbo" });
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## Prefix messages

You can also pass messages that the model should add before your prompt. This is useful for adding context to the model, or past conversation history.

```typescript
const model = new OpenAIChat({
  modelName: "gpt-3.5-turbo",
  prefixMessages: [
    { role: "user", content: "My name is John" },
    { role: "assistant", content: "Hi there" },
  ],
});
const res = await model.call("What is my name");
console.log({ res });
```
