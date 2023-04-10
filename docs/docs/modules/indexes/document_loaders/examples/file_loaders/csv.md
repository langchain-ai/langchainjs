# CSV files

This example goes over how to load data from CSV files. The second argument is the `column` name to extract from the CSV file. One document will be created for each row in the CSV file. When `column` is not specified, each row is converted into a key/value pair with each key/value pair outputted to a new line in the document's `pageContent`. When `column` is specified, one document is created for each row, and the value of the specified column is used as the document's pageContent.

## Setup

```bash npm2yarn
npm install d3-dsv
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
import { CSVLoader } from "langchain/document_loaders";

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
import { CSVLoader } from "langchain/document_loaders";

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

## Usage, extracting a single column with metadata

Example CSV file:

```csv
hadith_id,chapter_no,hadith_no,chapter,text_ar,text_en,source
91,3,91,Knowledge - كتاب العلم,"حدثنا عبد الله بن محمد... ثم أدها إليه ".","Narrated Zaid bin Khalid Al-Juhani:... for the wolf.",Sahih Bukhari
92,3,92,Knowledge - كتاب العلم,"حدثنا محمد بن العلاء... إلى الله عز وجل.","Narrated Abu Musa:... (Our offending you).",Sahih Bukhari
93,3,93,Knowledge - كتاب العلم,"حدثنا أبو اليمان... وبمحمد صلى الله عليه وسلم نبيا، فسكت.","Narrated Anas bin Malik:... the Prophet became silent.",Sahih Bukhari
```

Example code:

```typescript
import { CSVLoader } from "langchain/document_loaders";

const loader = new CSVLoader(
  "all_hadiths_clean.csv",
  "text_ar",
  ["text_en", "source", "hadith_id", "chapter_no", "hadith_no", "chapter"]
);

const docs = await loader.load();
/*
[
  Document {
    pageContent: 'حدثنا عبد الله بن محمد... ثم أدها إليه ".',
    metadata: {
      text_en: ' Narrated Zaid bin Khalid Al-Juhani:... for the wolf."',
      source: 'Sahih Bukhari',
      hadith_id: '91',
      chapter_no: '3',
      hadith_no: ' 91 ',
      chapter: 'Knowledge - كتاب العلم',
      line: 91
    }
  },
  Document {
    pageContent: 'حدثنا محمد بن العلاء... إلى الله عز وجل.',
    metadata: {
      text_en: ' Narrated Abu Musa:... (Our offending you).',
      source: 'Sahih Bukhari',
      hadith_id: '92',
      chapter_no: '3',
      hadith_no: ' 92 ',
      chapter: 'Knowledge - كتاب العلم',
      line: 92
    }
  },
  Document {
    pageContent: 'حدثنا أبو اليمان... وبمحمد صلى الله عليه وسلم نبيا، فسكت.',
    metadata: {
      text_en: ' Narrated Anas bin Malik:... the Prophet became silent.',
      source: 'Sahih Bukhari',
      hadith_id: '93',
      chapter_no: '3',
      hadith_no: ' 93 ',
      chapter: 'Knowledge - كتاب العلم',
      line: 93
    }
  }
]
*/
```


