---
title: "RemoteRetriever"
---

# RemoteRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**RemoteRetriever**

## Implements

- [`RemoteRetrieverParams`](../interfaces/RemoteRetrieverParams.md)

## Constructors

### constructor()

> **new RemoteRetriever**(«destructured»: [`RemoteRetrieverParams`](../interfaces/RemoteRetrieverParams.md)): [`RemoteRetriever`](RemoteRetriever.md)

#### Parameters

| Parameter        | Type                                                              |
| :--------------- | :---------------------------------------------------------------- |
| `«destructured»` | [`RemoteRetrieverParams`](../interfaces/RemoteRetrieverParams.md) |

#### Returns

[`RemoteRetriever`](RemoteRetriever.md)

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/remote/base.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L35)

## Properties

### asyncCaller

> **asyncCaller**: `AsyncCaller`

#### Defined in

[langchain/src/retrievers/remote/base.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L33)

### auth

> **auth**: [`RemoteRetrieverAuth`](../types/RemoteRetrieverAuth.md)

The authentication method to use, currently implemented is

- false: no authentication
- { bearer: string }: Bearer token authentication

#### Implementation of

[RemoteRetrieverParams](../interfaces/RemoteRetrieverParams.md).[auth](../interfaces/RemoteRetrieverParams.md#auth)

#### Defined in

[langchain/src/retrievers/remote/base.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L29)

### headers

> **headers**: `Record`<`string`, `string`\>

#### Defined in

[langchain/src/retrievers/remote/base.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L31)

### url

> **url**: `string`

The URL of the remote retriever server

#### Implementation of

[RemoteRetrieverParams](../interfaces/RemoteRetrieverParams.md).[url](../interfaces/RemoteRetrieverParams.md#url)

#### Defined in

[langchain/src/retrievers/remote/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L27)

## Methods

### createJsonBody()

> `Abstract` **createJsonBody**(`query`: `string`): [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

[`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)

#### Defined in

[langchain/src/retrievers/remote/base.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L49)

### getRelevantDocuments()

> **getRelevantDocuments**(`query`: `string`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[getRelevantDocuments](../../schema/classes/BaseRetriever.md#getrelevantdocuments)

#### Defined in

[langchain/src/retrievers/remote/base.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L53)

### processJsonResponse()

> `Abstract` **processJsonResponse**(`json`: [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md)): [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]

#### Parameters

| Parameter | Type                                                         |
| :-------- | :----------------------------------------------------------- |
| `json`    | [`RemoteRetrieverValues`](../types/RemoteRetrieverValues.md) |

#### Returns

[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]

#### Defined in

[langchain/src/retrievers/remote/base.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/remote/base.ts#L51)
