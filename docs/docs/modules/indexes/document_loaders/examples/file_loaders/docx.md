---
hide_table_of_contents: true
---

# Docx files

This example goes over how to load data from docx files.

# Setup

```bash npm2yarn
npm install mammoth
```

# Usage

```typescript
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import * as url from "node:url";
import * as path from "node:path";

const filePath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "src/document_loaders/tests/example_data/attention.docx"
);

const loader = new DocxLoader(filePath);

const docs = await loader.load();
```
