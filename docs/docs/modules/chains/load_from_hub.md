# Load from Hub

[LangChainHub](https://github.com/hwchase17/langchain-hub) contains a collection of chains which can be loaded directly via LangChain.

```typescript
import { loadChain } from "langchain/chains";

const chain = await loadChain("lc://chains/hello-world/chain.json");
const res = chain.call({ topic: "foo" });
console.log(res);
```
