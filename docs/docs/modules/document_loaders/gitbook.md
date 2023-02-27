# GitBook

This example goes over how to load data from any GitBook.

## Load from single GitBook page

```typescript
import { GitbookLoader } from "langchain/document_loaders";

const loader = new GitbookLoader("https://docs.gitbook.com");
const docs = await loader.load();
console.log({ docs });
```

## Load from all paths in a given GitBook

For this to work, the GitbookLoader needs to be initialized with the root path (https://docs.gitbook.com in this example) and have loadAllPaths set to True.

```typescript
import { GitbookLoader } from "langchain/document_loaders";

const loader = new GitbookLoader("https://docs.gitbook.com", {
  shouldLoadAllPaths: true,
});
const docs = await loader.load();
console.log({ docs });
```
