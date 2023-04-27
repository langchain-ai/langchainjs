---
title: "Milvus"
---

# Milvus

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**Milvus**

## Constructors

### constructor()

> **new Milvus**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)): [`Milvus`](Milvus.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)           |

#### Returns

[`Milvus`](Milvus.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/milvus.ts:94](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L94)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### client

> **client**: `MilvusClient`

#### Defined in

[langchain/src/vectorstores/milvus.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L66)

### colMgr

> **colMgr**: `Collection`

#### Defined in

[langchain/src/vectorstores/milvus.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L68)

### collectionName

> **collectionName**: `string`

#### Defined in

[langchain/src/vectorstores/milvus.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L52)

### dataMgr

> **dataMgr**: `Data`

#### Defined in

[langchain/src/vectorstores/milvus.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L72)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### fields

> **fields**: `string`[]

#### Defined in

[langchain/src/vectorstores/milvus.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L64)

### idxMgr

> **idxMgr**: `Index`

#### Defined in

[langchain/src/vectorstores/milvus.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L70)

### indexCreateParams

> **indexCreateParams**: `object`

#### Type declaration

| Member        | Type     |
| :------------ | :------- |
| `index_type`  | `string` |
| `metric_type` | `string` |
| `params`      | `string` |

#### Defined in

[langchain/src/vectorstores/milvus.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L86)

### indexParams

> **indexParams**: `Record`<`IndexType`, `IndexParam`\>

#### Defined in

[langchain/src/vectorstores/milvus.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L74)

### indexSearchParams

> **indexSearchParams**: `string`

#### Defined in

[langchain/src/vectorstores/milvus.ts:92](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L92)

### primaryField

> **primaryField**: `string`

#### Defined in

[langchain/src/vectorstores/milvus.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L58)

### textField

> **textField**: `string`

#### Defined in

[langchain/src/vectorstores/milvus.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L62)

### vectorField

> **vectorField**: `string`

#### Defined in

[langchain/src/vectorstores/milvus.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L60)

### autoId?

> **autoId**: `boolean`

#### Defined in

[langchain/src/vectorstores/milvus.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L56)

### numDimensions?

> **numDimensions**: `number`

#### Defined in

[langchain/src/vectorstores/milvus.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L54)

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

[langchain/src/vectorstores/milvus.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L118)

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

[langchain/src/vectorstores/milvus.ts:126](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L126)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`Milvus`](Milvus.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`Milvus`](Milvus.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### createCollection()

> **createCollection**(`vectors`: `number`[][], `documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `vectors`   | `number`[][]                                                                      |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/milvus.ts:275](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L275)

### ensureCollection()

> **ensureCollection**(`vectors`?: `number`[][], `documents`?: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `vectors?`   | `number`[][]                                                                      |
| `documents?` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/milvus.ts:253](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L253)

### grabCollectionFields()

> **grabCollectionFields**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/milvus.ts:332](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L332)

### similaritySearch()

> **similaritySearch**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| `object` = `undefined`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type                    | Default value |
| :-------- | :---------------------- | :------------ |
| `query`   | `string`                | `undefined`   |
| `k`       | `number`                | `4`           |
| `filter`  | `undefined` \| `object` | `undefined`   |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearch](../../vectorstores_base/classes/VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/base.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L62)

### similaritySearchVectorWithScore()

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `query`   | `number`[] |
| `k`       | `number`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/milvus.ts:186](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L186)

### similaritySearchWithScore()

> **similaritySearchWithScore**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| `object` = `undefined`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                    | Default value |
| :-------- | :---------------------- | :------------ |
| `query`   | `string`                | `undefined`   |
| `k`       | `number`                | `4`           |
| `filter`  | `undefined` \| `object` | `undefined`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)): `Promise`<[`Milvus`](Milvus.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig?`  | [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)                                 |

#### Returns

`Promise`<[`Milvus`](Milvus.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/milvus.ts:390](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L390)

### fromExistingCollection()

> `Static` **fromExistingCollection**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)): `Promise`<[`Milvus`](Milvus.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`   | [`MilvusLibArgs`](../interfaces/MilvusLibArgs.md)           |

#### Returns

`Promise`<[`Milvus`](Milvus.md)\>

#### Defined in

[langchain/src/vectorstores/milvus.ts:404](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L404)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: `object`): `Promise`<[`Milvus`](Milvus.md)\>

#### Parameters

| Parameter                  | Type                                                        |
| :------------------------- | :---------------------------------------------------------- |
| `texts`                    | `string`[]                                                  |
| `metadatas`                | `object` \| `object`[]                                      |
| `embeddings`               | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig?`                | `object`                                                    |
| `dbConfig.collectionName?` | `string`                                                    |
| `dbConfig.url?`            | `string`                                                    |

#### Returns

`Promise`<[`Milvus`](Milvus.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/milvus.ts:369](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/milvus.ts#L369)
