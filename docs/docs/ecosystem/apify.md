# Apify

This page covers how to use [Apify](https://apify.com) within LangChain.

## Overview

Apify is a cloud platform for web scraping and data extraction,
which provides an [ecosystem](https://apify.com/store) of more than a thousand
ready-made apps called _Actors_ for various scraping, crawling, and extraction use cases.

[![Apify Actors](/img/ApifyActors.png)](https://apify.com/store)

This integration enables you run Actors on the Apify platform and load their results into LangChain to feed your vector
indexes with documents and data from the web, e.g. to generate answers from websites with documentation,
blogs, or knowledge bases.

## Installation and Setup

- Install the [Apify API client](https://npmjs.com/package/apify-client) using your favorite package manager:

```bash npm2yarn
npm install apify-client
```

- Get your [Apify API token](https://console.apify.com/account/integrations) and either set it as
  an environment variable (`APIFY_API_TOKEN`) or pass it to the `ApifyWrapper` in the constructor.

## Wrappers

### Utility

You can use the `ApifyWrapper` to run Actors on the Apify platform.

```ts
import { ApifyWrapper } from "langchain/tools";
```

For a more detailed walkthrough of this wrapper, see [this guide](../modules/agents/tools/integrations/apify.md).

### Loader

You can also use our `ApifyDatasetLoader` to get data from Apify dataset.

```ts
import { ApifyDatasetLoader } from "langchain/document_loaders/web/apify_dataset";
```

For a more detailed walkthrough of this loader, see [this guide](../modules/indexes/document_loaders/examples/web_loaders/apify_dataset.md).
