# Cohere

This guide goes through how to use the Cohere LLM wrapper.

```typescript
import { Cohere } from "langchain/llms";

const model = new Cohere({ maxTokens: 20 });
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```
