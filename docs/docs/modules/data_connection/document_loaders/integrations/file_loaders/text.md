---
hide_table_of_contents: true
---

# Text files

This example goes over how to load data from text files.

```typescript
import { TextLoader } from "langchain/document_loaders/fs/text";

const loader = new TextLoader("src/document_loaders/example_data/example.txt");

const docs = await loader.load();
```
