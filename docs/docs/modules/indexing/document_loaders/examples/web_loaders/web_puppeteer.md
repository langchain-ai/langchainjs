---
sidebar_position: 2
hide_table_of_contents: true
---

# Webpages, with Puppeteer

This example goes over how to load data from webpages using Puppeteer. One document will be created for each webpage.

Puppeteer is a Node.js library that provides a high-level API for controlling headless Chrome or Chromium. You can use Puppeteer to automate web page interactions, including extracting data from dynamic web pages that require JavaScript to render.

If you want a lighterweight solution, and the webpages you want to load do not require JavaScript to render, you can use the [CheerioWebBaseLoader](./web_cheerio.md) instead.

## Setup

```bash npm2yarn
npm install puppeteer
```

## Usage

```typescript
import { PuppeteerWebBaseLoader } from "langchain/document_loaders";

/**
 * Loader uses `page.evaluate(() => document.body.innerHTML)`
 * as default evaluate function
 **/
const loader = new PuppeteerWebBaseLoader("https://www.tabnews.com.br/");

const docs = await loader.load();
```

## Options

Here's an explanation of the parameters you can pass to the PuppeteerWebBaseLoader constructor using the PuppeteerWebBaseLoaderOptions interface:

```typescript
type PuppeteerWebBaseLoaderOptions = {
  launchOptions?: PuppeteerLaunchOptions;
  gotoOptions?: PuppeteerGotoOptions;
  evaluate?: (page: Page, browser: Browser) => Promise<string>;
};
```

1. `launchOptions`: an optional object that specifies additional options to pass to the puppeteer.launch() method. This can include options such as the headless flag to launch the browser in headless mode, or the slowMo option to slow down Puppeteer's actions to make them easier to follow.

2. `gotoOptions`: an optional object that specifies additional options to pass to the page.goto() method. This can include options such as the timeout option to specify the maximum navigation time in milliseconds, or the waitUntil option to specify when to consider the navigation as successful.

3. `evaluate`: an optional function that can be used to evaluate JavaScript code on the page using the page.evaluate() method. This can be useful for extracting data from the page or interacting with page elements. The function should return a Promise that resolves to a string containing the result of the evaluation.

By passing these options to the `PuppeteerWebBaseLoader` constructor, you can customize the behavior of the loader and use Puppeteer's powerful features to scrape and interact with web pages.

Here is a basic example to do it:

```typescript
import { PuppeteerWebBaseLoader } from "langchain/document_loaders";

const loader = new PuppeteerWebBaseLoader("https://www.tabnews.com.br/", {
  launchOptions: {
    headless: true,
  },
  gotoOptions: {
    waitUntil: "domcontentloaded",
  },
  /** Pass custom evaluate, in this case you get page and browser instances */
  async evaluate(page: Page, browser: Browser) {
    await page.waitForResponse("https://www.tabnews.com.br/va/view");

    const result = await page.evaluate(() => document.body.innerHTML);
    return result;
  },
});

const docs = await loader.load();
```
