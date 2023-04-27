---
title: "OpenSearchVectorStore"
---

# OpenSearchVectorStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**OpenSearchVectorStore**

## Constructors

### constructor()

> **new OpenSearchVectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md)): [`OpenSearchVectorStore`](OpenSearchVectorStore.md)

#### Parameters

| Parameter    | Type                                                            |
| :----------- | :-------------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)     |
| `args`       | [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md) |

#### Returns

[`OpenSearchVectorStore`](OpenSearchVectorStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/opensearch.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L44)

## Properties

### FilterType

> **FilterType**: `object`

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/opensearch.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L28)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

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

[langchain/src/vectorstores/opensearch.ts:57](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L57)

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

[langchain/src/vectorstores/opensearch.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L65)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### deleteIfExists()

> **deleteIfExists**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/opensearch.ts:234](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L234)

### doesIndexExist()

> **doesIndexExist**(): `Promise`<`boolean`\>

#### Returns

`Promise`<`boolean`\>

#### Defined in

[langchain/src/vectorstores/opensearch.ts:221](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L221)

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

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`, `filter`?: `object`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `query`   | `number`[] |
| `k`       | `number`   |
| `filter?` | `object`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/opensearch.ts:91](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L91)

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

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md)): `Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`   | [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md)                   |

#### Returns

`Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/opensearch.ts:141](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L141)

### fromExistingIndex()

> `Static` **fromExistingIndex**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md)): `Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                            |
| :----------- | :-------------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)     |
| `dbConfig`   | [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md) |

#### Returns

`Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Defined in

[langchain/src/vectorstores/opensearch.ts:151](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L151)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md)): `Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                            |
| :----------- | :-------------------------------------------------------------- |
| `texts`      | `string`[]                                                      |
| `metadatas`  | `object` \| `object`[]                                          |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)     |
| `args`       | [`OpenSearchClientArgs`](../interfaces/OpenSearchClientArgs.md) |

#### Returns

`Promise`<[`OpenSearchVectorStore`](OpenSearchVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/opensearch.ts:127](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/opensearch.ts#L127)
