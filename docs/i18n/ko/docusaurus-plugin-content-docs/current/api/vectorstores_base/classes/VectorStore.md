---
title: "VectorStore"
---

# VectorStore

## Hierarchy

- [`SaveableVectorStore`](SaveableVectorStore.md)
- [`MemoryVectorStore`](../../vectorstores_memory/classes/MemoryVectorStore.md)
- [`Chroma`](../../vectorstores_chroma/classes/Chroma.md)
- [`WeaviateStore`](../../vectorstores_weaviate/classes/WeaviateStore.md)
- [`MongoVectorStore`](../../vectorstores_mongo/classes/MongoVectorStore.md)
- [`PineconeStore`](../../vectorstores_pinecone/classes/PineconeStore.md)
- [`SupabaseVectorStore`](../../vectorstores_supabase/classes/SupabaseVectorStore.md)
- [`OpenSearchVectorStore`](../../vectorstores_opensearch/classes/OpenSearchVectorStore.md)
- [`Milvus`](../../vectorstores_milvus/classes/Milvus.md)
- [`PrismaVectorStore`](../../vectorstores_prisma/classes/PrismaVectorStore.md)

## Constructors

### constructor()

> **new VectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `_dbConfig`: `Record`<`string`, `any`\>): [`VectorStore`](VectorStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `_dbConfig`  | `Record`<`string`, `any`\>                                 |

#### Returns

[`VectorStore`](VectorStore.md)

#### Defined in

[langchain/src/vectorstores/base.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L45)

## Properties

### FilterType

> **FilterType**: `object`

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

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

#### Defined in

[langchain/src/vectorstores/base.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L49)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](VectorStoreRetriever.md)<[`VectorStore`](VectorStore.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](VectorStoreRetriever.md)<[`VectorStore`](VectorStore.md)\>

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

#### Defined in

[langchain/src/vectorstores/base.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L88)
