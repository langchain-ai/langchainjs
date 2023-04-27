---
title: "ChatGPTPluginRetriever"
---

# ChatGPTPluginRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`RemoteRetriever`](RemoteRetriever.md).**ChatGPTPluginRetriever**

## Implements

- [`ChatGPTPluginRetrieverParams`](../interfaces/ChatGPTPluginRetrieverParams.md)

## Constructors

### constructor()

> **new ChatGPTPluginRetriever**(«destructured»: [`ChatGPTPluginRetrieverParams`](../interfaces/ChatGPTPluginRetrieverParams.md)): [`ChatGPTPluginRetriever`](ChatGPTPluginRetriever.md)

#### Parameters

| Parameter        | Type                                                                            |
| :--------------- | :------------------------------------------------------------------------------ |
| `«destructured»` | [`ChatGPTPluginRetrieverParams`](../interfaces/ChatGPTPluginRetrieverParams.md) |

#### Returns

[`ChatGPTPluginRetriever`](ChatGPTPluginRetriever.md)

#### Overrides

[RemoteRetriever](RemoteRetriever.md).[constructor](RemoteRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/remote/chatgpt-plugin.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/chatgpt-plugin.ts#L37)

## Properties

### asyncCaller

> **asyncCaller**: `AsyncCaller`

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[asyncCaller](RemoteRetriever.md#asynccaller)

#### Defined in

[langchain/src/retrievers/remote/base.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L33)

### auth

> **auth**: [`RemoteRetrieverAuth`](../types/RemoteRetrieverAuth.md)

The authentication method to use, currently implemented is

- false: no authentication
- { bearer: string }: Bearer token authentication

#### Implementation of

[ChatGPTPluginRetrieverParams](../interfaces/ChatGPTPluginRetrieverParams.md).[auth](../interfaces/ChatGPTPluginRetrieverParams.md#auth)

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[auth](RemoteRetriever.md#auth)

#### Defined in

[langchain/src/retrievers/remote/base.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L29)

### headers

> **headers**: `Record`<`string`, `string`\>

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[headers](RemoteRetriever.md#headers)

#### Defined in

[langchain/src/retrievers/remote/base.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L31)

### topK

> **topK**: `number`

The number of results to request from the ChatGPTRetrievalPlugin server

#### Implementation of

[ChatGPTPluginRetrieverParams](../interfaces/ChatGPTPluginRetrieverParams.md).[topK](../interfaces/ChatGPTPluginRetrieverParams.md#topk)

#### Defined in

[langchain/src/retrievers/remote/chatgpt-plugin.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/chatgpt-plugin.ts#L33)

### url

> **url**: `string`

The URL of the remote retriever server

#### Implementation of

[ChatGPTPluginRetrieverParams](../interfaces/ChatGPTPluginRetrieverParams.md).[url](../interfaces/ChatGPTPluginRetrieverParams.md#url)

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[url](RemoteRetriever.md#url)

#### Defined in

[langchain/src/retrievers/remote/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L27)

### filter?

> **filter**: [`ChatGPTPluginRetrieverFilter`](../interfaces/ChatGPTPluginRetrieverFilter.md)

The filter to use when querying the ChatGPTRetrievalPlugin server

#### Implementation of

[ChatGPTPluginRetrieverParams](../interfaces/ChatGPTPluginRetrieverParams.md).[filter](../interfaces/ChatGPTPluginRetrieverParams.md#filter)

#### Defined in

[langchain/src/retrievers/remote/chatgpt-plugin.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/chatgpt-plugin.ts#L35)

## Methods

### createJsonBody()

> **createJsonBody**(`query`: `string`): [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

[`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)

#### Overrides

[RemoteRetriever](RemoteRetriever.md).[createJsonBody](RemoteRetriever.md#createjsonbody)

#### Defined in

[langchain/src/retrievers/remote/chatgpt-plugin.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/chatgpt-plugin.ts#L43)

### getRelevantDocuments()

> **getRelevantDocuments**(`query`: `string`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[getRelevantDocuments](RemoteRetriever.md#getrelevantdocuments)

#### Defined in

[langchain/src/retrievers/remote/base.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L53)

### processJsonResponse()

> **processJsonResponse**(`json`: [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)): [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]

#### Parameters

| Parameter | Type                                                         |
| :-------- | :----------------------------------------------------------- |
| `json`    | [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md) |

#### Returns

[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]

#### Overrides

[RemoteRetriever](RemoteRetriever.md).[processJsonResponse](RemoteRetriever.md#processjsonresponse)

#### Defined in

[langchain/src/retrievers/remote/chatgpt-plugin.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/chatgpt-plugin.ts#L55)
