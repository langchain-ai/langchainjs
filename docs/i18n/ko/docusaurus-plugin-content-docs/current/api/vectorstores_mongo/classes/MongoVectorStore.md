---
title: "MongoVectorStore"
---

# MongoVectorStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**MongoVectorStore**

## Constructors

### constructor()

> **new MongoVectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`MongoLibArgs`](../types/MongoLibArgs.md)): [`MongoVectorStore`](MongoVectorStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`MongoLibArgs`](../types/MongoLibArgs.md)                  |

#### Returns

[`MongoVectorStore`](MongoVectorStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/mongo.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L29)

## Properties

### FilterType

> **FilterType**: [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/mongo.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L21)

### client

> **client**: `MongoClient`

#### Defined in

[langchain/src/vectorstores/mongo.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L25)

### collection

> **collection**: `Collection`<`Document`\>

#### Defined in

[langchain/src/vectorstores/mongo.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L23)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### indexName

> **indexName**: `string`

#### Defined in

[langchain/src/vectorstores/mongo.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L27)

## Methods

### addDocuments()

> **addDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addDocuments](../../vectorstores_base/classes/VectorStore.md#adddocuments)

#### Defined in

[langchain/src/vectorstores/mongo.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L36)

### addVectors()

> **addVectors**(`vectors`: `number`[][], `documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `vectors`   | `number`[][]                                                                      |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addVectors](../../vectorstores_base/classes/VectorStore.md#addvectors)

#### Defined in

[langchain/src/vectorstores/mongo.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L44)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md)): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Parameters

| Parameter | Type                                                                           |
| :-------- | :----------------------------------------------------------------------------- |
| `k?`      | `number`                                                                       |
| `filter?` | [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### similaritySearch()

> **similaritySearch**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) = `undefined`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type                                                                                          | Default value |
| :-------- | :-------------------------------------------------------------------------------------------- | :------------ |
| `query`   | `string`                                                                                      | `undefined`   |
| `k`       | `number`                                                                                      | `4`           |
| `filter`  | `undefined` \| [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) | `undefined`   |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearch](../../vectorstores_base/classes/VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/base.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L62)

### similaritySearchVectorWithScore()

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`, `filter`?: [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md)): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                                                                           |
| :-------- | :----------------------------------------------------------------------------- |
| `query`   | `number`[]                                                                     |
| `k`       | `number`                                                                       |
| `filter?` | [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/mongo.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L54)

### similaritySearchWithScore()

> **similaritySearchWithScore**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) = `undefined`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                                                                                          | Default value |
| :-------- | :-------------------------------------------------------------------------------------------- | :------------ |
| `query`   | `string`                                                                                      | `undefined`   |
| `k`       | `number`                                                                                      | `4`           |
| `filter`  | `undefined` \| [`MongoVectorStoreQueryExtension`](../types/MongoVectorStoreQueryExtension.md) | `undefined`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`MongoLibArgs`](../types/MongoLibArgs.md)): `Promise`<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`   | [`MongoLibArgs`](../types/MongoLibArgs.md)                                        |

#### Returns

`Promise`<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/mongo.ts:142](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L142)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`MongoLibArgs`](../types/MongoLibArgs.md)): `Promise`<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `texts`      | `string`[]                                                  |
| `metadatas`  | `object` \| `object`[]                                      |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`   | [`MongoLibArgs`](../types/MongoLibArgs.md)                  |

#### Returns

`Promise`<[`MongoVectorStore`](MongoVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/mongo.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/mongo.ts#L124)
