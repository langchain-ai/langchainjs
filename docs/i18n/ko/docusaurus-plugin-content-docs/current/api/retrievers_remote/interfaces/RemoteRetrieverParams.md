---
title: "RemoteRetrieverParams"
---

# RemoteRetrieverParams

## Hierarchy

- `AsyncCallerParams`.**RemoteRetrieverParams**

## Properties

### auth

> **auth**: [`RemoteRetrieverAuth`](../types/RemoteRetrieverAuth.md)

The authentication method to use, currently implemented is

- false: no authentication
- { bearer: string }: Bearer token authentication

#### Defined in

[langchain/src/retrievers/remote/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L20)

### url

> **url**: `string`

The URL of the remote retriever server

#### Defined in

[langchain/src/retrievers/remote/base.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L13)

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
