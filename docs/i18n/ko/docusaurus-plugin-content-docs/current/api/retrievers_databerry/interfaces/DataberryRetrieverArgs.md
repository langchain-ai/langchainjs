---
title: "DataberryRetrieverArgs"
---

# DataberryRetrieverArgs

## Hierarchy

- `AsyncCallerParams`.**DataberryRetrieverArgs**

## Properties

### datastoreUrl

> **datastoreUrl**: `string`

#### Defined in

[langchain/src/retrievers/databerry.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L6)

### apiKey?

> **apiKey**: `string`

#### Defined in

[langchain/src/retrievers/databerry.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L8)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

AsyncCallerParams.maxConcurrency

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

AsyncCallerParams.maxRetries

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### topK?

> **topK**: `number`

#### Defined in

[langchain/src/retrievers/databerry.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L7)
