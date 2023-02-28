# JSON files

This example goes over how to load data from JSON files. The second argument is a JSONPointer to the array of strings to extract from the JSON file. One document will be created for each string in the array. You can omit the second argument to load a JSON file containing an array of strings.

Example JSON file:

```json
{
  "texts": ["This is a sentence.", "This is another sentence."]
}
```

Example code:

```typescript
import { JSONLoader } from "langchain/document_loaders";

const loader = new JSONLoader(
  "src/document_loaders/example_data/example.json",
  "/texts"
);
const docs = await loader.load();
console.log({ docs });
```
