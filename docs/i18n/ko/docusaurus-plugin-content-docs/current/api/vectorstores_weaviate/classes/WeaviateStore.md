---
title: "WeaviateStore"
---

# WeaviateStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**WeaviateStore**

## Constructors

### constructor()

> **new WeaviateStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)): [`WeaviateStore`](WeaviateStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)       |

#### Returns

[`WeaviateStore`](WeaviateStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L42)

## Properties

### FilterType

> **FilterType**: [`WeaviateFilter`](../interfaces/WeaviateFilter.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L32)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L42)

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

[langchain/src/vectorstores/weaviate.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L76)

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

[langchain/src/vectorstores/weaviate.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L55)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: [`WeaviateFilter`](../interfaces/WeaviateFilter.md)): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`WeaviateStore`](WeaviateStore.md)\>

#### Parameters

| Parameter | Type                                                |
| :-------- | :-------------------------------------------------- |
| `k?`      | `number`                                            |
| `filter?` | [`WeaviateFilter`](../interfaces/WeaviateFilter.md) |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`WeaviateStore`](WeaviateStore.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### similaritySearch()

> **similaritySearch**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| [`WeaviateFilter`](../interfaces/WeaviateFilter.md) = `undefined`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type                                                               | Default value |
| :-------- | :----------------------------------------------------------------- | :------------ |
| `query`   | `string`                                                           | `undefined`   |
| `k`       | `number`                                                           | `4`           |
| `filter`  | `undefined` \| [`WeaviateFilter`](../interfaces/WeaviateFilter.md) | `undefined`   |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearch](../../vectorstores_base/classes/VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/base.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L62)

### similaritySearchVectorWithScore()

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`, `filter`?: [`WeaviateFilter`](../interfaces/WeaviateFilter.md)): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                                                |
| :-------- | :-------------------------------------------------- |
| `query`   | `number`[]                                          |
| `k`       | `number`                                            |
| `filter?` | [`WeaviateFilter`](../interfaces/WeaviateFilter.md) |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L83)

### similaritySearchWithScore()

> **similaritySearchWithScore**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| [`WeaviateFilter`](../interfaces/WeaviateFilter.md) = `undefined`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                                                               | Default value |
| :-------- | :----------------------------------------------------------------- | :------------ |
| `query`   | `string`                                                           | `undefined`   |
| `k`       | `number`                                                           | `4`           |
| `filter`  | `undefined` \| [`WeaviateFilter`](../interfaces/WeaviateFilter.md) | `undefined`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)): `Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `args`       | [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)                             |

#### Returns

`Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:141](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L141)

### fromExistingIndex()

> `Static` **fromExistingIndex**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)): `Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)       |

#### Returns

`Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Defined in

[langchain/src/vectorstores/weaviate.ts:151](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L151)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)): `Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `texts`      | `string`[]                                                  |
| `metadatas`  | `object` \| `object`[]                                      |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`WeaviateLibArgs`](../interfaces/WeaviateLibArgs.md)       |

#### Returns

`Promise`<[`WeaviateStore`](WeaviateStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/weaviate.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/weaviate.ts#L123)
