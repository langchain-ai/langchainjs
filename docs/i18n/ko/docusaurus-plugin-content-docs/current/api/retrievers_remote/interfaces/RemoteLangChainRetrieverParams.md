---
title: "RemoteLangChainRetrieverParams"
---

# RemoteLangChainRetrieverParams

## Hierarchy

- [`RemoteRetrieverParams`](RemoteRetrieverParams.md).**RemoteLangChainRetrieverParams**

## Properties

### auth

> **auth**: [`RemoteRetrieverAuth`](../types/RemoteRetrieverAuth.md)

The authentication method to use, currently implemented is

- false: no authentication
- { bearer: string }: Bearer token authentication

#### Inherited from

[RemoteRetrieverParams](RemoteRetrieverParams.md).[auth](RemoteRetrieverParams.md#auth)

#### Defined in

[langchain/src/retrievers/remote/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L20)

### url

> **url**: `string`

The URL of the remote retriever server

#### Inherited from

[RemoteRetrieverParams](RemoteRetrieverParams.md).[url](RemoteRetrieverParams.md#url)

#### Defined in

[langchain/src/retrievers/remote/base.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L13)

### inputKey?

> **inputKey**: `string`

The key in the JSON body to put the query in

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L12)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

[RemoteRetrieverParams](RemoteRetrieverParams.md).[maxConcurrency](RemoteRetrieverParams.md#maxconcurrency)

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

[RemoteRetrieverParams](RemoteRetrieverParams.md).[maxRetries](RemoteRetrieverParams.md#maxretries)

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### metadataKey?

> **metadataKey**: `string`

The key in the JSON response to get the metadata from

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L24)

### pageContentKey?

> **pageContentKey**: `string`

The key in the JSON response to get the page content from

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L20)

### responseKey?

> **responseKey**: `string`

The key in the JSON response to get the response from

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L16)
