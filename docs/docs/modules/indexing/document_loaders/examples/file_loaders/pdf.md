---
hide_table_of_contents: true
---

# PDF files

This example goes over how to load data from PDF files. One document will be created for each PDF file.

# Setup

```bash npm2yarn
npm install pdf-parse
```

# Usage

```typescript
import { PDFLoader } from "langchain/document_loaders";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf");

const docs = await loader.load();
```
