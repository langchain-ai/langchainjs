---
title: "MemoryVectorStore"
---

# MemoryVectorStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**MemoryVectorStore**

## Constructors

### constructor()

> **new MemoryVectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), «destructured»: [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md) = `{}`): [`MemoryVectorStore`](MemoryVectorStore.md)

#### Parameters

| Parameter        | Type                                                              |
| :--------------- | :---------------------------------------------------------------- |
| `embeddings`     | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)       |
| `«destructured»` | [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md) |

#### Returns

[`MemoryVectorStore`](MemoryVectorStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L22)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### memoryVectors

> **memoryVectors**: `MemoryVector`[] = `[]`

#### Defined in

[langchain/src/vectorstores/memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L18)

### similarity

> **similarity**: `Function`

#### Type declaration

Returns the average of cosine distances between vectors a and b

> (`a`: `NumberArray`, `b`: `NumberArray`): `number`

##### Parameters

| Parameter | Type          | Description   |
| :-------- | :------------ | :------------ |
| `a`       | `NumberArray` | first vector  |
| `b`       | `NumberArray` | second vector |

##### Returns

`number`

#### Defined in

[langchain/src/vectorstores/memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L20)

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

[langchain/src/vectorstores/memory.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L31)

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

[langchain/src/vectorstores/memory.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L39)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

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

[langchain/src/vectorstores/memory.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L49)

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

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md)): `Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig?`  | [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md)                 |

#### Returns

`Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/memory.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L90)

### fromExistingIndex()

> `Static` **fromExistingIndex**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md)): `Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                              |
| :----------- | :---------------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)       |
| `dbConfig?`  | [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md) |

#### Returns

`Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Defined in

[langchain/src/vectorstores/memory.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L100)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`?: [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md)): `Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                              |
| :----------- | :---------------------------------------------------------------- |
| `texts`      | `string`[]                                                        |
| `metadatas`  | `object` \| `object`[]                                            |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)       |
| `dbConfig?`  | [`MemoryVectorStoreArgs`](../interfaces/MemoryVectorStoreArgs.md) |

#### Returns

`Promise`<[`MemoryVectorStore`](MemoryVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/memory.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L72)
