# CSV files

This example goes over how to load data from CSV files. The second argument is the column name to extract from the CSV file. One document will be created for each row in the CSV file.

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
console.log({ docs });
```
