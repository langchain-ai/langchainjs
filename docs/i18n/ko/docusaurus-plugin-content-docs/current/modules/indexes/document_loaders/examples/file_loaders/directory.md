---
sidebar_position: 1
hide_table_of_contents: true
---

# Folders with multiple files

이 예제에서는 여러 file들을 가지고 있는 folder에서 data를 로드하는 방법에 대해 설명합니다. 두 번째 인자는 loader factories로 넘길 파일 확장자에 대한 map입니다. 각 file은 매칭되는 loader로 전달되고 결과로 나온 document들은 하나로 연결됩니다.

폴더 예시:

```text
src/document_loaders/example_data/example/
├── example.json
├── example.jsonl
├── example.txt
└── example.csv
```

코드 예시:

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
