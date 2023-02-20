# OpenAI

This guide goes through how to use the OpenAI LLM wrapper.

```typescript
import { OpenAI } from "langchain/llms";

const model = new OpenAI({ temperature: 0.9 });
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```
