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

You can also load all of the files in the directory using `UnstructuredDirectoryLoader`,
which inherits from `DirectoryLoader`:

```typescript
import { UnstructuredDirectoryLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredDirectoryLoader(
  "https://api.unstructured.io/general/v0/general",
  "langchain/src/document_loaders/tests/example_data"
);
const docs = await loader.load();
```

Currently, the `UnstructuredLoader` supports the following document types:

- Plain text files (`.txt`/`.text`)
- PDFs (`.pdf`)
- Word Documents (`.doc`/`.docx`)
- PowerPoints (`.ppt`/`.pptx`)
- Images (`.jpg`/`.jpeg`)
- Emails (`.eml`/`.msg`)
- HTML (`.html`)
- Markdown Files (`.md`)
- Rich Text Files (`.rtf`)

The output from the `UnstructuredLoader` will be an array of `Document` objects that looks
like the following:

```typescript
Document {
  pageContent: 'Decoder: The decoder is also composed of a stack of N = 6
identical layers. In addition to the two sub-layers in each encoder layer, the decoder inserts a
third sub-layer, wh
ich performs multi-head attention over the output of the encoder stack. Similar to the encoder, we
employ residual connections around each of the sub-layers, followed by layer normalization. We also
modify the self
-attention sub-layer in the decoder stack to prevent positions from attending to subsequent
positions. This masking, combined with fact that the output embeddings are offset by one position,
ensures that the predic
tions for position i can depend only on the known outputs at positions less than i.',
  metadata: {
    page_number: 3,
    filename: '1706.03762.pdf',
    category: 'NarrativeText'
  }
},
Document {
  pageContent: '3.2 Attention',
  metadata: { page_number: 3, filename: '1706.03762.pdf', category: 'Title'
}
},
```
