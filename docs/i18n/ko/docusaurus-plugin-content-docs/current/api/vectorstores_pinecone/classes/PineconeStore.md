---
title: "PineconeStore"
---

# PineconeStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**PineconeStore**

## Constructors

### constructor()

> **new PineconeStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)): [`PineconeStore`](PineconeStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)       |

#### Returns

[`PineconeStore`](PineconeStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L33)

## Properties

### FilterType

> **FilterType**: `PineconeMetadata`

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L23)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### pineconeIndex

> **pineconeIndex**: `VectorOperationsApi`

#### Defined in

[langchain/src/vectorstores/pinecone.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L29)

### textKey

> **textKey**: `string`

#### Defined in

[langchain/src/vectorstores/pinecone.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L25)

### filter?

> **filter**: `PineconeMetadata`

#### Defined in

[langchain/src/vectorstores/pinecone.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L31)

### namespace?

> **namespace**: `string`

#### Defined in

[langchain/src/vectorstores/pinecone.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L27)

## Methods

### addDocuments()

> **addDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `ids`?: `string`[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `ids?`      | `string`[]                                                                        |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addDocuments](../../vectorstores_base/classes/VectorStore.md#adddocuments)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L43)

### addVectors()

> **addVectors**(`vectors`: `number`[][], `documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `ids`?: `string`[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `vectors`   | `number`[][]                                                                      |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `ids?`      | `string`[]                                                                        |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addVectors](../../vectorstores_base/classes/VectorStore.md#addvectors)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L52)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `PineconeMetadata`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`PineconeStore`](PineconeStore.md)\>

#### Parameters

| Parameter | Type               |
| :-------- | :----------------- |
| `k?`      | `number`           |
| `filter?` | `PineconeMetadata` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`PineconeStore`](PineconeStore.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### similaritySearch()

> **similaritySearch**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| `PineconeMetadata` = `undefined`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type                              | Default value |
| :-------- | :-------------------------------- | :------------ |
| `query`   | `string`                          | `undefined`   |
| `k`       | `number`                          | `4`           |
| `filter`  | `undefined` \| `PineconeMetadata` | `undefined`   |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearch](../../vectorstores_base/classes/VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/base.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L62)

### similaritySearchVectorWithScore()

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`, `filter`?: `PineconeMetadata`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type               |
| :-------- | :----------------- |
| `query`   | `number`[]         |
| `k`       | `number`           |
| `filter?` | `PineconeMetadata` |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:92](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L92)

### similaritySearchWithScore()

> **similaritySearchWithScore**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| `PineconeMetadata` = `undefined`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                              | Default value |
| :-------- | :-------------------------------- | :------------ |
| `query`   | `string`                          | `undefined`   |
| `k`       | `number`                          | `4`           |
| `filter`  | `undefined` \| `PineconeMetadata` | `undefined`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)): `Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`   | [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)                             |

#### Returns

`Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:162](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L162)

### fromExistingIndex()

> `Static` **fromExistingIndex**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)): `Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`   | [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md)       |

#### Returns

`Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Defined in

[langchain/src/vectorstores/pinecone.ts:175](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L175)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md) \| \{`pineconeClient`: `VectorOperationsApi`;
> `namespace`?: `string`;
> `textKey`?: `string`;}): `Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Parameters

| Parameter    | Type                                                                                                                                                         |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `texts`      | `string`[]                                                                                                                                                   |
| `metadatas`  | `object` \| `object`[]                                                                                                                                       |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                                                                                                  |
| `dbConfig`   | [`PineconeLibArgs`](../interfaces/PineconeLibArgs.md) \| \{`pineconeClient`: `VectorOperationsApi`;<br />`namespace`?: `string`;<br />`textKey`?: `string`;} |

#### Returns

`Promise`<[`PineconeStore`](PineconeStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/pinecone.ts:126](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/pinecone.ts#L126)
