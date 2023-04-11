---
hide_table_of_contents: true
---

# IMSDB

This example goes over how to load data from the internet movie script database website, using Cheerio. One document will be created for each page.

## Setup

```bash npm2yarn
npm install cheerio
```

## Usage

```typescript
import { IMSDBLoader } from "langchain/document_loaders/web/imsdb";

const loader = new IMSDBLoader("https://imsdb.com/scripts/BlacKkKlansman.html");

const docs = await loader.load();
```
