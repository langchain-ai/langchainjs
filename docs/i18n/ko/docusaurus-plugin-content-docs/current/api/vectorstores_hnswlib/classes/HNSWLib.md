---
title: "HNSWLib"
---

# HNSWLib

## Hierarchy

- [`SaveableVectorStore`](../../vectorstores_base/classes/SaveableVectorStore.md).**HNSWLib**

## Constructors

### constructor()

> **new HNSWLib**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`HNSWLibArgs`](../interfaces/HNSWLibArgs.md)): [`HNSWLib`](HNSWLib.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`HNSWLibArgs`](../interfaces/HNSWLibArgs.md)               |

#### Returns

[`HNSWLib`](HNSWLib.md)

#### Overrides

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[constructor](../../vectorstores_base/classes/SaveableVectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L27)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[FilterType](../../vectorstores_base/classes/SaveableVectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### args

> **args**: [`HNSWLibBase`](../interfaces/HNSWLibBase.md)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L25)

### docstore

> **docstore**: [`InMemoryDocstore`](../../docstore/classes/InMemoryDocstore.md)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L23)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[embeddings](../../vectorstores_base/classes/SaveableVectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### \_index?

> **\_index**: `HierarchicalNSW`

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L21)

## Accessors

### index

> **index**(): `HierarchicalNSW`

#### Returns

`HierarchicalNSW`

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L66)

> **index**(`index`: `HierarchicalNSW`): `void`

#### Parameters

| Parameter | Type              |
| :-------- | :---------------- |
| `index`   | `HierarchicalNSW` |

#### Returns

`void`

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:75](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L75)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L66)
[langchain/src/vectorstores/hnswlib.ts:75](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L75)

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

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[addDocuments](../../vectorstores_base/classes/SaveableVectorStore.md#adddocuments)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L35)

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

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[addVectors](../../vectorstores_base/classes/SaveableVectorStore.md#addvectors)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L79)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`HNSWLib`](HNSWLib.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`HNSWLib`](HNSWLib.md)\>

#### Inherited from

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[asRetriever](../../vectorstores_base/classes/SaveableVectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### save()

> **save**(`directory`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter   | Type     |
| :---------- | :------- |
| `directory` | `string` |

#### Returns

`Promise`<`void`\>

#### Overrides

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[save](../../vectorstores_base/classes/SaveableVectorStore.md#save)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L136)

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

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[similaritySearch](../../vectorstores_base/classes/SaveableVectorStore.md#similaritysearch)

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

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/SaveableVectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:109](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L109)

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

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/SaveableVectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: `object`): `Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Parameters

| Parameter            | Type                                                                              |
| :------------------- | :-------------------------------------------------------------------------------- |
| `docs`               | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings`         | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig?`          | `object`                                                                          |
| `dbConfig.docstore?` | [`InMemoryDocstore`](../../docstore/classes/InMemoryDocstore.md)                  |

#### Returns

`Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Overrides

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[fromDocuments](../../vectorstores_base/classes/SaveableVectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:193](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L193)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: `object`): `Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Parameters

| Parameter            | Type                                                             |
| :------------------- | :--------------------------------------------------------------- |
| `texts`              | `string`[]                                                       |
| `metadatas`          | `object` \| `object`[]                                           |
| `embeddings`         | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)      |
| `dbConfig?`          | `object`                                                         |
| `dbConfig.docstore?` | [`InMemoryDocstore`](../../docstore/classes/InMemoryDocstore.md) |

#### Returns

`Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Overrides

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[fromTexts](../../vectorstores_base/classes/SaveableVectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:173](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L173)

### imports()

> `Static` **imports**(): `Promise`<\{`HierarchicalNSW`: _typeof_ `HierarchicalNSW`;}\>

#### Returns

`Promise`<\{`HierarchicalNSW`: _typeof_ `HierarchicalNSW`;}\>

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L209)

### load()

> `Static` **load**(`directory`: `string`, `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)): `Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `directory`  | `string`                                                    |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |

#### Returns

`Promise`<[`HNSWLib`](HNSWLib.md)\>

#### Overrides

[SaveableVectorStore](../../vectorstores_base/classes/SaveableVectorStore.md).[load](../../vectorstores_base/classes/SaveableVectorStore.md#load)

#### Defined in

[langchain/src/vectorstores/hnswlib.ts:153](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/hnswlib.ts#L153)
