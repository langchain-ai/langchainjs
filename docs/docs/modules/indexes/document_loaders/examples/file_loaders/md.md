# Markdown files

This example goes over how to load data from MarkdownFiles. By default, it will divide different sections of the markdown file into it's own document. You can change this behavior by setting the `splitSections` option to `false`.

## Setup

```bash npm2yarn
npm install marked
```

## Usage

For each of the different scenarios below, we will use the following Markdown file as the input:

```markdown
# Section 1

This is the first section.

## Section 2

This is the second section.

### Subsection 2.1

This is the first subsection of the second section.

## Section 3

This is the third section.

### Subsection 3.1

This is the first subsection of the third section.
```

### One document per section

Example code:

```typescript
import { MarkdownLoader } from "langchain/document_loaders/fs/markdown";

const loader = new MarkdownLoader(
  "src/document_loaders/example_data/example.md"
);

const docs = await loader.load();
/*
[
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 1,
      "section": 1,
      "source": "blob",
    },
    "pageContent": "# Section 1

This is the first section.",
  },
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 2,
      "section": 2,
      "source": "blob",
    },
    "pageContent": "# Section 2

This is the second section.

### Subsection 2.1

This is the first subsection of the second section.",
  },
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 3,
      "section": 3,
      "source": "blob",
    },
    "pageContent": "# Section 3

This is the third section.

### Subsection 3.1

This is the first subsection of the third section.",
]
*/
```

### One document per file

```typescript
import { MarkdownLoader } from "langchain/document_loaders/fs/markdown";

const loader = new MarkdownLoader(
  "src/document_loaders/example_data/example.md",
  { splitSections: false }
);

const docs = await loader.load();

/*
[
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 1,
      "source": "blob",
    },
    "pageContent": "# Section 1

This is the first section.

# Section 2

This is the second section.

{...rest of the file}",
  },
]
*/
```

### Changing the header depth

By default, the MarkdownLoader splits the file into sections based on the headerDepth of 2, or in html terms, the `h2`. You can change this behavior by setting the `headerDepth` option to a different number. Setting it to 3 will split the file into sections based on the `h3` header. Here's an example:

```typescript
import { MarkdownLoader } from "langchain/document_loaders/fs/markdown";

const loader = new MarkdownLoader(
  "src/document_loaders/example_data/example.md",
  { headerDepth: 3 }
);

const docs = await loader.load();

/*
[
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 1,
      "section": 1,
      "source": "blob",
    },
    "pageContent": "# Section 1

This is the first section.",
  },
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 2,
      "section": 2,
      "source": "blob",
    },
    "pageContent": "## Section 2

This is the second section.",
  },
  Document {
    "metadata": {
      "blobType": "text/markdown",
      "line": 3,
      "section": 3,
      "source": "blob",
    },
    "pageContent": "### Subsection 2.1

This is the first subsection of the second section.",
  },
  ...
]
*/
```
