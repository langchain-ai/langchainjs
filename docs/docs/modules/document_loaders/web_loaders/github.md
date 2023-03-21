# GitHub

This example goes over how to load data from a GitHub repository.

```typescript
import { GithubRepoLoader } from "langchain/document_loaders";

const loader = new GithubRepoLoader(
  "https://github.com/hwchase17/langchainjs",
  { branch: "main", recursive: false, unknown: "warn" }
);
const docs = await loader.load();
console.log({ docs });
```
