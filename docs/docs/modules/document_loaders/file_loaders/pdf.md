# PDF files

This example goes over how to load data from PDF files.

```typescript
import { PDFLoader } from "langchain/document_loaders";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf");
const docs = await loader.load();
console.log({ docs });
```
