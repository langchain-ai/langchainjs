---
title: "OpenAIEmbeddingsParams"
---

# OpenAIEmbeddingsParams

## Hierarchy

- [`EmbeddingsParams`](../../embeddings_base/types/EmbeddingsParams.md).**OpenAIEmbeddingsParams**

## Properties

### modelName

> **modelName**: `string`

Model name to use

#### Defined in

[langchain/src/embeddings/openai.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L13)

### batchSize?

> **batchSize**: `number`

The maximum number of documents to embed in a single request. This is
limited by the OpenAI API to a maximum of 2048.

#### Defined in

[langchain/src/embeddings/openai.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L24)

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

### stripNewLines?

> **stripNewLines**: `boolean`

Whether to strip new lines from the input text. This is recommended by
OpenAI, but may not be suitable for all use cases.

#### Defined in

[langchain/src/embeddings/openai.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L30)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Defined in

[langchain/src/embeddings/openai.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L18)
