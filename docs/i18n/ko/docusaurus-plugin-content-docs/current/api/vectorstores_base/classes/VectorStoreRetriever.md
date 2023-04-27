---
title: "VectorStoreRetriever<V>"
---

# VectorStoreRetriever<V\>

Base Index class. All indexes should extend this class.

## Type parameters

- `V` _extends_ [`VectorStore`](VectorStore.md) = [`VectorStore`](VectorStore.md)

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**VectorStoreRetriever**

## Constructors

### constructor()

> **new VectorStoreRetriever**<V\>(`fields`: `object`): [`VectorStoreRetriever`](VectorStoreRetriever.md)<`V`\>

#### Type parameters

- `V` _extends_ [`VectorStore`](VectorStore.md)<`V`\> = [`VectorStore`](VectorStore.md)

#### Parameters

| Parameter            | Type              |
| :------------------- | :---------------- |
| `fields`             | `object`          |
| `fields.vectorStore` | `V`               |
| `fields.filter?`     | `V`["FilterType"] |
| `fields.k?`          | `number`          |

#### Returns

[`VectorStoreRetriever`](VectorStoreRetriever.md)<`V`\>

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/vectorstores/base.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L14)

## Properties

### k

> **k**: `number` = `4`

#### Defined in

[langchain/src/vectorstores/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L10)

### vectorStore

> **vectorStore**: `V`

#### Defined in

[langchain/src/vectorstores/base.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L8)

### filter?

> **filter**: `V`["FilterType"]

#### Defined in

[langchain/src/vectorstores/base.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L12)

## Methods

### addDocuments()

> **addDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/base.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L34)

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

[langchain/src/vectorstores/base.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L25)
