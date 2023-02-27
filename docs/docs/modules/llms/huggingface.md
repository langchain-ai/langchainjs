# HuggingFaceInference

This guide goes through how to use the HuggingFaceInference LLM wrapper.

```typescript
import { HuggingFaceInference } from "langchain/llms";

const model = new HuggingFaceInference();
const res = await model.call("1 + 1 =");
console.log({ res });
```
