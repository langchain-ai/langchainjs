---
hide_table_of_contents: true
---

# GitBook

This example goes over how to load data from any GitBook, using Cheerio. One document will be created for each page.

## Setup

```bash npm2yarn
npm install cheerio
```

## Load from single GitBook page

```typescript
import { GitbookLoader } from "langchain/document_loaders/web/gitbook";

const loader = new GitbookLoader(
  "https://docs.gitbook.com/product-tour/navigation"
);

const docs = await loader.load();
```

## Load from all paths in a given GitBook

For this to work, the GitbookLoader needs to be initialized with the root path (https://docs.gitbook.com in this example) and have `shouldLoadAllPaths` set to `true`.

```typescript
import { GitbookLoader } from "langchain/document_loaders/web/gitbook";

const loader = new GitbookLoader("https://docs.gitbook.com", {
  shouldLoadAllPaths: true,
});

const docs = await loader.load();
```
