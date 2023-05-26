---
sidebar_position: 1
hide_table_of_contents: true
---

# Folders with multiple files

This example goes over how to load data from folders with multiple files. The second argument is a map of file extensions to loader factories. Each file will be passed to the matching loader, and the resulting documents will be concatenated together.

Example folder:

```text
src/document_loaders/example_data/example/
├── example.json
├── example.jsonl
├── example.txt
├── example.csv
└── example.md
```

## Usage, simple extensions

```typescript
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import {
  JSONLoader,
  JSONLinesLoader,
} from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";

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

## Usage, glob extensions

```typescript
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import {
  JSONLoader,
  JSONLinesLoader,
} from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";

const loader = new DirectoryLoader(
  "src/document_loaders/example_data/example",
  {
    ".json": (path) => new JSONLoader(path, "/texts"),
    ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
    ".{txt,md}": (path) => new TextLoader(path),
    ".csv": (path) => new CSVLoader(path, "text"),
  }
);
const docs = await loader.load();
console.log({ docs });
```

The code block shows how to use the `DocumentLoader` to load documents from a directory using extension keys as blob patterns instead of static extensions. This pattern matching allows using a common loader for similar extensions, which can help to reduce code duplication and simplify the loading process.
