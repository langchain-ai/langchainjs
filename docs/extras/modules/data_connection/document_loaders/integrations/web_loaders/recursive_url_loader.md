---
sidebar_class_name: node-only
hide_table_of_contents: true
---

# Recursive URL Loader

We may want to process load all URLs under a root directory.

For example, let's look at the [LangChainJS introduction(https://js.langchain.com/docs/get_started/introduction)] Document.

This has many interesting child pages that we may want to read in bulk.

The challenge is traversing the tree of child pages and assembling a list!

We do this using the RecursiveUrlLoader.

This also gives us the flexibility to exclude some children, customize the extractor, and more.

## Setup

To get started, you'll need to install the `jsdom` package:

```bash npm2yarn
npm i jsdom
```

We also suggest adding a package like `html-to-text` for extracting the raw text from the page.

```bash npm2yarn
npm i html-to-text
```

## Usage

```typescript
import { compile } from "html-to-text";
import { RecursiveUrlLoader } from "langchain/document_loaders/web/recursive_url_loader";

const url = "https://js.langchain.com/docs/get_started/introduction";

const compiledConvert = compile({ wordwrap: 130 }); // returns (input: string;) => string;

const loader = new RecursiveUrlLoader(url, {
  extractor: compiledConvert,
  maxDepth: 1,
  excludeDirs: ["https://js.langchain.com/docs/api/"],
});

const docs = await loader.load();
```

## Options

```typescript
interface Options {
  excludeDirs?: string[]; // webpage directories to exclude.
  extractor?: (text: string) => string;; // a function to extract the text of the document from the webpage, by default it returns the page as it is. It is recommended to use tools like html-to-text to extract the text. By default, it just returns the page as it is.
  maxDepth?: number; // the maximum depth to crawl. By default, it is set to 2. If you need to crawl the whole website, set it to a number that is large enough would simply do the job.
  timeout?: number; // the timeout for each request, in the unit of seconds. By default, it is set to 10000 (10 seconds).
  preventOutside?: boolean; // whether to prevent crawling outside the root url. By default, it is set to true.
  callerOptions?: AsyncCallerConstructorParams; // the options to call the AsyncCaller for example setting max concurrency (default is 64)
}
```

However, since it's hard to perform a perfect filter, you may still see some irrelevant results in the results. You can perform a filter on the returned documents by yourself, if it's needed. Most of the time, the returned results are good enough.
