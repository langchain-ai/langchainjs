---
sidebar_position: 1
hide_table_of_contents: true
---

# Webpages, with Cheerio

This example goes over how to load data from webpages using Cheerio. One document will be created for each webpage.

Cheerio is a fast and lightweight library that allows you to parse and traverse HTML documents using a jQuery-like syntax. You can use Cheerio in Node.js to extract data from web pages, without having to render them in a browser.

However, Cheerio does not simulate a web browser, so it cannot execute JavaScript code on the page. This means that it cannot extract data from dynamic web pages that require JavaScript to render. To do that, you can use the [PuppeteerWebBaseLoader](./web_puppeteer.md) instead.

## Setup

```bash npm2yarn
npm install cheerio
```

## Usage

```typescript
import { CheerioWebBaseLoader } from "langchain/document_loaders";

const loader = new CheerioWebBaseLoader(
  "https://news.ycombinator.com/item?id=34817881"
);

const docs = await loader.load();
```
