# JSONLines files

This example goes over how to load data from JSONLines or JSONL files. The second argument is a JSONPointer to the property to extract from each JSON object in the file. One document will be created for each JSON object in the file.

Example JSONLines file:

```json
{"html": "This is a sentence."}
{"html": "This is another sentence."}
```

Example code:

```typescript
import { JSONLinesLoader } from "langchain/document_loaders";

const loader = new JSONLinesLoader(
  "src/document_loaders/example_data/example.jsonl",
  "/html"
);
const docs = await loader.load();
console.log({ docs });
```
