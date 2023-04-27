---
title: "CohereEmbeddingsParams"
---

# CohereEmbeddingsParams

## Hierarchy

- [`EmbeddingsParams`](../../embeddings_base/types/EmbeddingsParams.md).**CohereEmbeddingsParams**

## Properties

### modelName

> **modelName**: `string`

#### Defined in

[langchain/src/embeddings/cohere.ts:5](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L5)

### batchSize?

> **batchSize**: `number`

The maximum number of documents to embed in a single request. This is
limited by the Cohere API to a maximum of 96.

#### Defined in

[langchain/src/embeddings/cohere.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L11)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

EmbeddingsParams.maxConcurrency

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

EmbeddingsParams.maxRetries

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)
