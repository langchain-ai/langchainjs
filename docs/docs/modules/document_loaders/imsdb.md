# IMSDB

This example goes over how to load data from the internet movie script database website.

```typescript
import { IMSDBLoader } from "langchain/document_loaders";

const loader = new IMSDBLoader("https://imsdb.com/scripts/BlacKkKlansman.html");
const docs = await loader.load();
console.log({ docs });
```
