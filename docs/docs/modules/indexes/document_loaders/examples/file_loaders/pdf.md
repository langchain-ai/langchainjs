---
hide_table_of_contents: true
---

# PDF files

This example goes over how to load data from PDF files. By default, one document will be created for each page in the PDF file, you can change this behavior by setting the `splitPages` option to `false`.

# Setup

```bash npm2yarn
npm install pdfjs-dist
```

# Usage, one document per page

```typescript
import { PDFLoader } from "langchain/document_loaders";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf");

const docs = await loader.load();
```

# Usage, one document per file

```typescript
import { PDFLoader } from "langchain/document_loaders";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  splitPages: false,
});

const docs = await loader.load();
```
