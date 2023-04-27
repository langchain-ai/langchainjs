---
title: "Chroma"
---

# Chroma

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**Chroma**

## Constructors

### constructor()

> **new Chroma**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`ChromaLibArgs`](../types/ChromaLibArgs.md)): [`Chroma`](Chroma.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`ChromaLibArgs`](../types/ChromaLibArgs.md)                |

#### Returns

[`Chroma`](Chroma.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/chroma.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L31)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### collectionName

> **collectionName**: `string`

#### Defined in

[langchain/src/vectorstores/chroma.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L25)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### url

> **url**: `string`

#### Defined in

[langchain/src/vectorstores/chroma.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L29)

### collection?

> **collection**: `Collection`

#### Defined in

[langchain/src/vectorstores/chroma.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L23)

### index?

> **index**: `ChromaClient`

#### Defined in

[langchain/src/vectorstores/chroma.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L21)

### numDimensions?

> **numDimensions**: `number`

#### Defined in

[langchain/src/vectorstores/chroma.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L27)

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

[langchain/src/vectorstores/chroma.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L43)

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

[langchain/src/vectorstores/chroma.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L65)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`Chroma`](Chroma.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`Chroma`](Chroma.md)\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### ensureCollection()

> **ensureCollection**(): `Promise`<`Collection`\>

#### Returns

`Promise`<`Collection`\>

#### Defined in

[langchain/src/vectorstores/chroma.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L51)

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

[langchain/src/vectorstores/chroma.ts:93](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L93)

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

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: `object`): `Promise`<[`Chroma`](Chroma.md)\>

#### Parameters

| Parameter                  | Type                                                                              |
| :------------------------- | :-------------------------------------------------------------------------------- |
| `docs`                     | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings`               | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`                 | `object`                                                                          |
| `dbConfig.collectionName?` | `string`                                                                          |
| `dbConfig.url?`            | `string`                                                                          |

#### Returns

`Promise`<[`Chroma`](Chroma.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/chroma.ts:144](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L144)

### fromExistingCollection()

> `Static` **fromExistingCollection**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: `object`): `Promise`<[`Chroma`](Chroma.md)\>

#### Parameters

| Parameter                 | Type                                                        |
| :------------------------ | :---------------------------------------------------------- |
| `embeddings`              | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`                | `object`                                                    |
| `dbConfig.collectionName` | `string`                                                    |
| `dbConfig.url?`           | `string`                                                    |

#### Returns

`Promise`<[`Chroma`](Chroma.md)\>

#### Defined in

[langchain/src/vectorstores/chroma.ts:157](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L157)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: `object`): `Promise`<[`Chroma`](Chroma.md)\>

#### Parameters

| Parameter                  | Type                                                        |
| :------------------------- | :---------------------------------------------------------- |
| `texts`                    | `string`[]                                                  |
| `metadatas`                | `object` \| `object`[]                                      |
| `embeddings`               | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`                 | `object`                                                    |
| `dbConfig.collectionName?` | `string`                                                    |
| `dbConfig.url?`            | `string`                                                    |

#### Returns

`Promise`<[`Chroma`](Chroma.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/chroma.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L123)

### imports()

> `Static` **imports**(): `Promise`<\{`ChromaClient`: _typeof_ `ChromaClient`;}\>

#### Returns

`Promise`<\{`ChromaClient`: _typeof_ `ChromaClient`;}\>

#### Defined in

[langchain/src/vectorstores/chroma.ts:169](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/chroma.ts#L169)
