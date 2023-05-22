---
hide_table_of_contents: true
---

# EPUB files

This example goes over how to load data from EPUB files. By default, one document will be created for each chapter in the EPUB file, you can change this behavior by setting the `splitChapters` option to `false`.

# Setup

```bash npm2yarn
npm install epub2 html-to-text
```

# Usage, one document per chapter

```typescript
import { EPubLoader } from "langchain/document_loaders/fs/epub";
import * as url from "node:url";
import * as path from "node:path";


const filePath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "src/document_loaders/example_data/example.epub"
);

const loader = new EPubLoader(filePath);

const docs = await loader.load();
```

# Usage, one document per file

```typescript
import { EPubLoader } from "langchain/document_loaders/fs/epub";
import * as url from "node:url";
import * as path from "node:path";


const filePath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "src/document_loaders/example_data/example.epub"
);

const loader = new EPubLoader(
  filePath,
  {
    splitChapters: false,
  }
);

const docs = await loader.load();
```
