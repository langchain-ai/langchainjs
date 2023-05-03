# Apify Dataset

This guide shows how to use the [Apify integration](../../../../../ecosystem/apify.md) for LangChain,
to load documents from an Apify Dataset.

## Overview

[Apify](https://apify.com) is a cloud platform for web scraping and data extraction,
which provides an [ecosystem](https://apify.com/store) of more than a thousand
ready-made apps called _Actors_ for various web scraping, crawling, and data extraction use cases.

This guide shows how to load documents
from an [Apify Dataset](https://docs.apify.com/platform/storage/dataset)—a scalable append-only
storage built for storing structured web scraping results,
such as a list of products or Google SERPs, and then export them to various
formats like JSON, CSV, or Excel.

Datasets are typically used to save results of Actors.
For example, [Website Content Crawler](https://apify.com/apify/website-content-crawler) Actor
deeply crawls websites such as documentation, knowledge bases, help centers, or blogs,
and then stores the text content of webpages into a dataset,
from which you can feed the documents into a vector index and answer questions from it.
For details, see [this guide](../../../../agents/tools/integrations/apify.md).

## Setup

```bash npm2yarn
npm install apify-client
```

You need to have an existing dataset on the Apify platform. If you don't have one, please first check out [this guide](../../../../agents/tools/integrations/apify.md) on how to use Apify to extract content from documentation, knowledge bases, help centers, or blogs.

First, import `ApifyDatasetLoader` into your source code:

```ts
import { ApifyDatasetLoader } from "langchain/document_loaders/web/apify_dataset";
import { Document } from "langchain/document";
```

Then provide a function that maps Apify dataset record fields to LangChain `Document` format.

For example, if your dataset items are structured like this:

```json
{
  "url": "https://apify.com",
  "text": "Apify is the best web scraping and automation platform."
}
```

The mapping function in the code below will convert them to LangChain `Document` format, so that you can use them further with any LLM model (e.g. for question answering).

```ts
const loader = new ApifyDatasetLoader(
  "your-dataset-id",
  (item) =>
    new Document({
      pageContent: (item.text || "") as string,
      metadata: { source: item.url },
    })
);
const docs = await loader.load();
```

## An example with question answering

In this example, we use data from a dataset to answer a question.

```ts
import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ApifyDatasetLoader } from "langchain/document_loaders/web/apify_dataset";
import { Document } from "langchain/document";

const OPENAI_API_KEY = "Your OpenAI API key";

// Initialize the LLM to use to answer the question.
const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY });
// Load the data from Apify Dataset
const loader = new ApifyDatasetLoader(
  "your-dataset-id",
  (item) =>
    new Document({
      pageContent: (item.text || "") as string,
      metadata: { source: item.url },
    })
);
const docs = await loader.load();
// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(
  docs,
  new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY })
);

// Create a chain that uses the OpenAI LLM and HNSWLib vector store.
const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  returnSourceDocuments: true,
});
const res = await chain.call({
  query: "What is Apify?",
});
// Output the results
console.log(res.text);
console.log(res.sourceDocuments.map((d: Document) => d.metadata.source));
```

```
Apify is a cloud platform that helps you build reliable web scrapers, fast, and automate anything you can do manually in a web browser.
[
  'https://docs.apify.com/platform',
  'https://docs.apify.com/platform/integrations',
  'https://docs.apify.com/platform/actors/publishing/monetize',
  'https://docs.apify.com/platform/security'
]
```
