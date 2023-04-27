---
title: "RemoteLangChainRetriever"
---

# RemoteLangChainRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`RemoteRetriever`](RemoteRetriever.md).**RemoteLangChainRetriever**

## Implements

- [`RemoteLangChainRetrieverParams`](../interfaces/RemoteLangChainRetrieverParams.md)

## Constructors

### constructor()

> **new RemoteLangChainRetriever**(«destructured»: [`RemoteLangChainRetrieverParams`](../interfaces/RemoteLangChainRetrieverParams.md)): [`RemoteLangChainRetriever`](RemoteLangChainRetriever.md)

#### Parameters

| Parameter        | Type                                                                                |
| :--------------- | :---------------------------------------------------------------------------------- |
| `«destructured»` | [`RemoteLangChainRetrieverParams`](../interfaces/RemoteLangChainRetrieverParams.md) |

#### Returns

[`RemoteLangChainRetriever`](RemoteLangChainRetriever.md)

#### Overrides

[RemoteRetriever](RemoteRetriever.md).[constructor](RemoteRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L39)

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

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[auth](../interfaces/RemoteLangChainRetrieverParams.md#auth)

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

### inputKey

> **inputKey**: `string`

The key in the JSON body to put the query in

#### Implementation of

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[inputKey](../interfaces/RemoteLangChainRetrieverParams.md#inputkey)

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L31)

### metadataKey

> **metadataKey**: `string`

The key in the JSON response to get the metadata from

#### Implementation of

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[metadataKey](../interfaces/RemoteLangChainRetrieverParams.md#metadatakey)

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L37)

### pageContentKey

> **pageContentKey**: `string`

The key in the JSON response to get the page content from

#### Implementation of

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[pageContentKey](../interfaces/RemoteLangChainRetrieverParams.md#pagecontentkey)

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L35)

### responseKey

> **responseKey**: `string`

The key in the JSON response to get the response from

#### Implementation of

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[responseKey](../interfaces/RemoteLangChainRetrieverParams.md#responsekey)

#### Defined in

[langchain/src/retrievers/remote/remote-retriever.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L33)

### url

> **url**: `string`

The URL of the remote retriever server

#### Implementation of

[RemoteLangChainRetrieverParams](../interfaces/RemoteLangChainRetrieverParams.md).[url](../interfaces/RemoteLangChainRetrieverParams.md#url)

#### Inherited from

[RemoteRetriever](RemoteRetriever.md).[url](RemoteRetriever.md#url)

#### Defined in

[langchain/src/retrievers/remote/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L27)

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

[langchain/src/retrievers/remote/remote-retriever.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L53)

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

[langchain/src/retrievers/remote/remote-retriever.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/remote-retriever.ts#L59)
