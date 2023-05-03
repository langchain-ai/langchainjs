# Apify

This guide shows how to use the [Apify integration](../../../../ecosystem/apify.md) for LangChain,
to run Actors and feed their results into LangChain.

## Overview

[Apify](https://apify.com) is a cloud platform for web scraping and data extraction,
which provides an [ecosystem](https://apify.com/store) of more than a thousand
ready-made apps called _Actors_ for various web scraping, crawling, and data extraction use cases.
For example, you can use it to extract Google Search results, Instagram and Facebook profiles, products from Amazon or Shopify, Google Maps reviews, etc.

In this example, we'll use the [Website Content Crawler](https://apify.com/apify/website-content-crawler) Actor,
which can deeply crawl websites such as documentation, knowledge bases, help centers, or blogs,
and extract text content from the web pages. Then we feed the documents into a vector index and answer questions from it.

## Setup

```bash npm2yarn
npm install apify-client
```

First, import `ApifyWrapper` and some other classes into your source code:

```ts
import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ApifyWrapper } from "langchain/tools";
import { Document } from "langchain/document";
```

Initialize it using your [Apify API token](https://console.apify.com/account/integrations) and for the purpose of this example, also with your OpenAI API key:

```ts
const OPENAI_API_KEY = "Your OpenAI API key";
const APIFY_API_TOKEN = "Your Apify API token";

const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY });
const apify = new ApifyWrapper(APIFY_API_TOKEN);
```

Then run the Actor, wait for it to finish, and fetch its results from the Apify dataset into a LangChain document loader.

Note that if you already have some results in an Apify dataset, you can load them directly using `ApifyDatasetLoader`, as shown in [this guide](../../../indexes/document_loaders/examples/web_loaders/apify_dataset.md). In that guide, you'll also find the explanation of the `datasetMappingFunction`, which is used to map fields from the Apify dataset records to LangChain `Document` fields.

```ts
const loader = await apify.callActor(
  "apify/website-content-crawler",
  { startUrls: [{ url: "https://js.langchain.com/docs/" }] },
  (item) =>
    new Document({
      pageContent: (item.text || "") as string,
      metadata: { source: item.url },
    })
);
const docs = await loader.load();
```

Initialize the vector index from the crawled documents:

```ts
const vectorStore = await HNSWLib.fromDocuments(
  docs,
  new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY })
);
```

Next, create the retrieval chain and enter a query:

```ts
const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  returnSourceDocuments: true,
});
const res = await chain.call({ query: "What is LangChain?" });
```

And finally, output the results:

```ts
console.log(res.text);
console.log(res.sourceDocuments.map((d) => d.metadata.source));
```

```
LangChain is a framework for developing applications powered by language models.
[
  'https://js.langchain.com/docs/',
  'https://js.langchain.com/docs/modules/chains/',
  'https://js.langchain.com/docs/modules/chains/llmchain/',
  'https://js.langchain.com/docs/category/functions-4'
]
```
