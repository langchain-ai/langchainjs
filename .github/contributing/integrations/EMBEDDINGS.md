# Contributing third-party Text Embeddings

This page contains some specific guidelines and examples for contributing integrations with third-party Text Embedding providers.

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**

## Example PR

We'll be referencing this PR adding Gradient Embeddings as an example: https://github.com/langchain-ai/langchainjs/pull/3475

## General ideas

The general idea for adding new third-party Text Embeddings is to subclass the `Embeddings` class and implement the `embedDocuments` and `embedQuery` methods. 

The `embedDocuments` method should take a list of documents and return a list of embeddings for each document. The `embedQuery` method should take a query and return an embedding for that query.

`embedQuery` can typically be implemented by calling `embedDocuments` with a list containing only the query.

## Wrap Text Embeddings requests in this.caller

The base Embeddings class contains an instance property called `caller` that will automatically handle retries, errors, timeouts, and more. You should wrap calls to the LLM in `this.caller.call` [as shown here](https://github.com/langchain-ai/langchainjs/blob/f469ec00d945a3f8421b32f4be78bce3f66a74bb/langchain/src/embeddings/gradient_ai.ts#L72)
