# Hacker News

This example goes over how to load data from the hacker news website.

```typescript
import { HNLoader } from "langchain/document_loaders";

const loader = new HNLoader("https://news.ycombinator.com/item?id=34817881");
const docs = await loader.load();
console.log({ docs });
```
