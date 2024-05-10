# CSV files

This example goes over how to load data from CSV files. The second argument is the `column` name to extract from the CSV file. One document will be created for each row in the CSV file. When `column` is not specified, each row is converted into a key/value pair with each key/value pair outputted to a new line in the document's `pageContent`. When `column` is specified, one document is created for each row, and the value of the specified column is used as the document's pageContent.

## Setup

```bash npm2yarn
npm install d3-dsv@2
```

## Usage, extracting all columns

Example CSV file:

```csv
id,text
1,This is a sentence.
2,This is another sentence.
```

Example code:

```typescript
import { CSVLoader } from "langchain/document_loaders/fs/csv";

const loader = new CSVLoader("src/document_loaders/example_data/example.csv");

const docs = await loader.load();
/*
[
  Document {
    "metadata": {
      "line": 1,
      "source": "src/document_loaders/example_data/example.csv",
    },
    "pageContent": "id: 1
text: This is a sentence.",
  },
  Document {
    "metadata": {
      "line": 2,
      "source": "src/document_loaders/example_data/example.csv",
    },
    "pageContent": "id: 2
text: This is another sentence.",
  },
]
*/
```

## Usage, extracting a single column

Example CSV file:

```csv
id,text
1,This is a sentence.
2,This is another sentence.
```

Example code:

```typescript
import { CSVLoader } from "langchain/document_loaders/fs/csv";

const loader = new CSVLoader(
  "src/document_loaders/example_data/example.csv",
  "text"
);

const docs = await loader.load();
/*
[
  Document {
    "metadata": {
      "line": 1,
      "source": "src/document_loaders/example_data/example.csv",
    },
    "pageContent": "This is a sentence.",
  },
  Document {
    "metadata": {
      "line": 2,
      "source": "src/document_loaders/example_data/example.csv",
    },
    "pageContent": "This is another sentence.",
  },
]
*/
```
