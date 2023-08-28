---
sidebar_position: 3
hide_table_of_contents: true
sidebar_class_name: node-only
sidebar_label: Playwright
---

# Webpages, with Playwright

:::tip Compatibility
Only available on Node.js.
:::

This example goes over how to load data from webpages using Playwright. One document will be created for each webpage.

Playwright is a Node.js library that provides a high-level API for controlling multiple browser engines, including Chromium, Firefox, and WebKit. You can use Playwright to automate web page interactions, including extracting data from dynamic web pages that require JavaScript to render.

If you want a lighterweight solution, and the webpages you want to load do not require JavaScript to render, you can use the [CheerioWebBaseLoader](./web_cheerio) instead.

## Setup

```bash npm2yarn
npm install playwright
```

## Usage

```typescript
import { PlaywrightWebBaseLoader } from "langchain/document_loaders/web/playwright";

/**
 * Loader uses `page.content()`
 * as default evaluate function
 **/
const loader = new PlaywrightWebBaseLoader("https://www.tabnews.com.br/");

const docs = await loader.load();
```

## Options

Here's an explanation of the parameters you can pass to the PlaywrightWebBaseLoader constructor using the PlaywrightWebBaseLoaderOptions interface:

```typescript
type PlaywrightWebBaseLoaderOptions = {
  launchOptions?: LaunchOptions;
  gotoOptions?: PlaywrightGotoOptions;
  evaluate?: PlaywrightEvaluate;
};
```

1. `launchOptions`: an optional object that specifies additional options to pass to the playwright.chromium.launch() method. This can include options such as the headless flag to launch the browser in headless mode.

2. `gotoOptions`: an optional object that specifies additional options to pass to the page.goto() method. This can include options such as the timeout option to specify the maximum navigation time in milliseconds, or the waitUntil option to specify when to consider the navigation as successful.

3. `evaluate`: an optional function that can be used to evaluate JavaScript code on the page using a custom evaluation function. This can be useful for extracting data from the page, interacting with page elements, or handling specific HTTP responses. The function should return a Promise that resolves to a string containing the result of the evaluation.

By passing these options to the `PlaywrightWebBaseLoader` constructor, you can customize the behavior of the loader and use Playwright's powerful features to scrape and interact with web pages.

Here is a basic example to do it:

```typescript
import {
  PlaywrightWebBaseLoader,
  Page,
  Browser,
} from "langchain/document_loaders/web/playwright";

const url = "https://www.tabnews.com.br/";
const loader = new PlaywrightWebBaseLoader(url);
const docs = await loader.load();

// raw HTML page content
const extractedContents = docs[0].pageContent;
```

And a more advanced example:

```typescript
import {
  PlaywrightWebBaseLoader,
  Page,
  Browser,
} from "langchain/document_loaders/web/playwright";

const loader = new PlaywrightWebBaseLoader("https://www.tabnews.com.br/", {
  launchOptions: {
    headless: true,
  },
  gotoOptions: {
    waitUntil: "domcontentloaded",
  },
  /** Pass custom evaluate, in this case you get page and browser instances */
  async evaluate(page: Page, browser: Browser, response: Response | null) {
    await page.waitForResponse("https://www.tabnews.com.br/va/view");

    const result = await page.evaluate(() => document.body.innerHTML);
    return result;
  },
});

const docs = await loader.load();
```
