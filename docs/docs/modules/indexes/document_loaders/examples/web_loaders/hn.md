---
hide_table_of_contents: true
---

# Hacker News

This example goes over how to load data from the hacker news website, using Cheerio. One document will be created for each page.

## Setup

```bash npm2yarn
npm install cheerio
```

## Usage

```typescript
import { HNLoader } from "langchain/document_loaders/web/hn";

const loader = new HNLoader("https://news.ycombinator.com/item?id=34817881");

const docs = await loader.load();
```
