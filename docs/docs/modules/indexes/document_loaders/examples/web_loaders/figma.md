---
hide_table_of_contents: true
---

# Figma

This example goes over how to load data from a Figma file.
You will need the `FIGMA_ACCESS_TOKEN` in order to fetch the Figma file.

```typescript
import { FigmaFileLoader } from "langchain/document_loaders/web/figma";

const loader = new FigmaFileLoader({
  accessToken: "FIGMA_ACCESS_TOKEN",
  ids: "ids",
  key: "key",
});
const docs = await loader.load();
```
