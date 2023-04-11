# Unstructured

This page covers how to use [Unstructured](https://unstructured.io) within LangChain.

## What is Unstructured?

Unstructured is an [open source](https://github.com/Unstructured-IO/unstructured) Python package
for extracting text from raw documents for use in machine learning applications. Currently,
Unstructured supports partitioning Word documents (in `.doc` or `.docx` format),
PowerPoints (in `.ppt` or `.pptx` format), PDFs, HTML files, images,
emails (in `.eml` or `.msg` format), epubs, markdown, and plain text files.
`unstructured` is a Python package and cannot be used directly with TS/JS, Unstructured
also maintains a [REST API](https://github.com/Unstructured-IO/unstructured-api) to support
pre-processing pipelines written in other programming languages. The endpoint for the
hosted Unstructured API is `https://api.unstructured.io/general/v0/general`, or you can run
the service locally using the instructions found
[here](https://github.com/Unstructured-IO/unstructured-api#dizzy-instructions-for-using-the-docker-image).

## Quick start

You can use Unstructured in`langchainjs` with the following code.
Replace the filename with the file you would like to process.
If you are running the container locally, switch the url to
`https://api.unstructured.io/general/v0/general`.

```typescript
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredLoader(
  "https://api.unstructured.io/general/v0/general",
  "langchain/src/document_loaders/tests/example_data/example.txt"
);
const docs = await loader.load();
```

Stayed tuned for future updates, including functionality equivalent to
`UnstructuredDirectoryLoader` in `langchain`!.
