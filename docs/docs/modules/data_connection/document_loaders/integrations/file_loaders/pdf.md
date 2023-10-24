# PDF files

This example goes over how to load data from PDF files. By default, one document will be created for each page in the PDF file, you can change this behavior by setting the `splitPages` option to `false`.

## Setup

```bash npm2yarn
npm install pdf-parse
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

## Usage, custom `pdfjs` build

By default we use the `pdfjs` build bundled with `pdf-parse`, which is compatible with most environments, including Node.js and modern browsers. If you want to use a more recent version of `pdfjs-dist` or if you want to use a custom build of `pdfjs-dist`, you can do so by providing a custom `pdfjs` function that returns a promise that resolves to the `PDFJS` object.

In the following example we use the "legacy" (see [pdfjs docs](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported)) build of `pdfjs-dist`, which includes several polyfills not included in the default build.

```bash npm2yarn
npm install pdfjs-dist
```

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

const loader = new PDFLoader("src/document_loaders/example_data/example.pdf", {
  // you may need to add `.then(m => m.default)` to the end of the import
  pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
});
```
