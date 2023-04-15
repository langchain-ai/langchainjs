# PDF files

This example goes over how to load data from PDF files. By default, one document will be created for each page in the PDF file, you can change this behavior by setting the `splitPages` option to `false`.

## Setup

```bash npm2yarn
npm install pdfjs-dist
```

## Usage, one document per page

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf");

const docs = await loader.load();
```

## Usage, one document per file

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  splitPages: false,
});

const docs = await loader.load();
```

## Usage, legacy environments

In legacy environments, you can use the `pdfjs` option to provide a function that returns a promise that resolves to the `PDFJS` object. This is useful if you want to use a custom build of `pdfjs-dist` or if you want to use a different version of `pdfjs-dist`.

Here we use the legacy build of `pdfjs-dist`, which includes several polyfills not included in the default build.

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  // you may need to add `.then(m => m.default)` to the end of the import
  pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
});
```

Alternatively, if the legacy build of `pdfjs-dist` doesn't work for you, you can use an older version bundled with `pdf-parse`:

```bash npm2yarn
npm rm pdfjs-dist # if you had installed it before
npm install pdf-parse
```

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  // you may need to add `.then(m => m.default)` to the end of the import
  pdfjs: () => import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"),
});
```
