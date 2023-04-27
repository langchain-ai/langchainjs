---
title: "SaveableVectorStore"
---

# SaveableVectorStore

## Hierarchy

- [`VectorStore`](VectorStore.md).**SaveableVectorStore**

## Constructors

### constructor()

> **new SaveableVectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `_dbConfig`: `Record`<`string`, `any`\>): [`SaveableVectorStore`](SaveableVectorStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `_dbConfig`  | `Record`<`string`, `any`\>                                 |

#### Returns

[`SaveableVectorStore`](SaveableVectorStore.md)

#### Inherited from

[VectorStore](VectorStore.md).[constructor](VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/base.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L45)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](VectorStore.md).[FilterType](VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](VectorStore.md).[embeddings](VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

## Methods

### addDocuments()

> `Abstract` **addDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Inherited from

[VectorStore](VectorStore.md).[addDocuments](VectorStore.md#adddocuments)

#### Defined in

[langchain/src/vectorstores/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L54)

### addVectors()

> `Abstract` **addVectors**(`vectors`: `number`[][], `documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `vectors`   | `number`[][]                                                                      |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<`void`\>

#### Inherited from

[VectorStore](VectorStore.md).[addVectors](VectorStore.md#addvectors)

#### Defined in

[langchain/src/vectorstores/base.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L49)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](VectorStoreRetriever.md)<[`SaveableVectorStore`](SaveableVectorStore.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](VectorStoreRetriever.md)<[`SaveableVectorStore`](SaveableVectorStore.md)\>

#### Inherited from

[VectorStore](VectorStore.md).[asRetriever](VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### save()

> `Abstract` **save**(`directory`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter   | Type     |
| :---------- | :------- |
| `directory` | `string` |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/base.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L120)

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

[VectorStore](VectorStore.md).[similaritySearch](VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/base.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L62)

### similaritySearchVectorWithScore()

> `Abstract` **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`, `filter`?: `object`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `query`   | `number`[] |
| `k`       | `number`   |
| `filter?` | `object`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](VectorStore.md).[similaritySearchVectorWithScore](VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L56)

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

[VectorStore](VectorStore.md).[similaritySearchWithScore](VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`_docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `_embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `_dbConfig`: `Record`<`string`, `any`\>): `Promise`<[`VectorStore`](VectorStore.md)\>

#### Parameters

| Parameter     | Type                                                                              |
| :------------ | :-------------------------------------------------------------------------------- |
| `_docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `_embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `_dbConfig`   | `Record`<`string`, `any`\>                                                       |

#### Returns

`Promise`<[`VectorStore`](VectorStore.md)\>

#### Inherited from

[VectorStore](VectorStore.md).[fromDocuments](VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/base.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L100)

### fromTexts()

> `Static` **fromTexts**(`_texts`: `string`[], `_metadatas`: `object` \| `object`[], `_embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `_dbConfig`: `Record`<`string`, `any`\>): `Promise`<[`VectorStore`](VectorStore.md)\>

#### Parameters

| Parameter     | Type                                                        |
| :------------ | :---------------------------------------------------------- |
| `_texts`      | `string`[]                                                  |
| `_metadatas`  | `object` \| `object`[]                                      |
| `_embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `_dbConfig`   | `Record`<`string`, `any`\>                                 |

#### Returns

`Promise`<[`VectorStore`](VectorStore.md)\>

#### Inherited from

[VectorStore](VectorStore.md).[fromTexts](VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/base.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L88)

### load()

> `Static` **load**(`_directory`: `string`, `_embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)): `Promise`<[`SaveableVectorStore`](SaveableVectorStore.md)\>

#### Parameters

| Parameter     | Type                                                        |
| :------------ | :---------------------------------------------------------- |
| `_directory`  | `string`                                                    |
| `_embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |

#### Returns

`Promise`<[`SaveableVectorStore`](SaveableVectorStore.md)\>

#### Defined in

[langchain/src/vectorstores/base.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L122)
