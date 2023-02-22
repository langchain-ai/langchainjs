# Text files

This example goes over how to load data from text files.

```typescript
import { CheerioWebBaseLoader } from "langchain/document_loaders";

const loader = new CheerioWebBaseLoader(
  "https://news.ycombinator.com/item?id=34817881"
);
const docs = await loader.load();
console.log({ docs });
```
