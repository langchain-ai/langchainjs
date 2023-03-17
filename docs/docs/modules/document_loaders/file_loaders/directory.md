---
sidebar_position: 1
---

# Folders with multiple files

This example goes over how to load data from folders with multiple files. The second argument is a map of file extensions to loader factories. Each file will be passed to the matching loader, and the resulting documents will be concatenated together.

Example folder:

```text
src/document_loaders/example_data/example/
├── example.json
├── example.jsonl
├── example.txt
└── example.csv
```

Example code:

```typescript
import {
  DirectoryLoader,
  JSONLoader,
  JSONLinesLoader,
  TextLoader,
  CSVLoader,
} from "langchain/document_loaders";

const loader = new DirectoryLoader(
  "src/document_loaders/example_data/example",
  {
    ".json": (path) => new JSONLoader(path, "/texts"),
    ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
    ".txt": (path) => new TextLoader(path),
    ".csv": (path) => new CSVLoader(path, "text"),
  }
);
const docs = await loader.load();
console.log({ docs });
```
