# College Confidential

This example goes over how to load data from the college confidential website.

```typescript
import { CollegeConfidentialLoader } from "langchain/document_loaders";

const loader = new CollegeConfidentialLoader(
  "https://www.collegeconfidential.com/colleges/brown-university/"
);
const docs = await loader.load();
console.log({ docs });
```
