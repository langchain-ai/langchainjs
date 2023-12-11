# Contributing third-party document loaders

This page contains some specific guidelines and examples for contributing integrations with third-party document loaders.

Document loaders are classes that pull in text from a given source and load them into chunks called **documents** for later use in queryable vector stores. Some example sources include PDFs, websites, and Notion docs.

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**

## Example PR

You can take a look at this PR adding Apify Datasets as an example when creating your own document loader integrations: https://github.com/langchain-ai/langchainjs/pull/1271
