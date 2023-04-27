---
title: "DataberryRetriever"
---

# DataberryRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**DataberryRetriever**

## Constructors

### constructor()

> **new DataberryRetriever**(«destructured»: [`DataberryRetrieverArgs`](../interfaces/DataberryRetrieverArgs.md)): [`DataberryRetriever`](DataberryRetriever.md)

#### Parameters

| Parameter        | Type                                                                |
| :--------------- | :------------------------------------------------------------------ |
| `«destructured»` | [`DataberryRetrieverArgs`](../interfaces/DataberryRetrieverArgs.md) |

#### Returns

[`DataberryRetriever`](DataberryRetriever.md)

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/databerry.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L27)

## Properties

### caller

> **caller**: `AsyncCaller`

#### Defined in

[langchain/src/retrievers/databerry.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L19)

### datastoreUrl

> **datastoreUrl**: `string`

#### Defined in

[langchain/src/retrievers/databerry.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L21)

### apiKey?

> **apiKey**: `string`

#### Defined in

[langchain/src/retrievers/databerry.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L25)

### topK?

> **topK**: `number`

#### Defined in

[langchain/src/retrievers/databerry.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L23)

## Methods

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

[langchain/src/retrievers/databerry.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/databerry.ts#L36)
