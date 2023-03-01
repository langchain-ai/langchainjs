---
sidebar_position: 3
---

# Load from Hub

[LangChainHub](https://github.com/hwchase17/langchain-hub) contains a collection of prompts which can be loaded directly via LangChain.

```typescript
import { loadPrompt } from "langchain/prompts";
const prompt = await loadPrompt("lc://prompts/hello-world/prompt.yaml");
const res = prompt.format({});
console.log({ res });
```
