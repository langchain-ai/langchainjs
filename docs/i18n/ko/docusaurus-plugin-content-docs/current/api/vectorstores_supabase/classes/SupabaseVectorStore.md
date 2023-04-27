---
title: "SupabaseVectorStore"
---

# SupabaseVectorStore

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**SupabaseVectorStore**

## Constructors

### constructor()

> **new SupabaseVectorStore**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)): [`SupabaseVectorStore`](SupabaseVectorStore.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)       |

#### Returns

[`SupabaseVectorStore`](SupabaseVectorStore.md)

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/supabase.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L31)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### client

> **client**: `default`<`any`, "public", `any`\>

#### Defined in

[langchain/src/vectorstores/supabase.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L25)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### queryName

> **queryName**: `string`

#### Defined in

[langchain/src/vectorstores/supabase.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L29)

### tableName

> **tableName**: `string`

#### Defined in

[langchain/src/vectorstores/supabase.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L27)

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

[langchain/src/vectorstores/supabase.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L39)

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

[langchain/src/vectorstores/supabase.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L47)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

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

[langchain/src/vectorstores/supabase.ts:69](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L69)

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

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)): `Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                                              |
| :----------- | :-------------------------------------------------------------------------------- |
| `docs`       | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`   | [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)                             |

#### Returns

`Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/supabase.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L120)

### fromExistingIndex()

> `Static` **fromExistingIndex**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)): `Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`   | [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)       |

#### Returns

`Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Defined in

[langchain/src/vectorstores/supabase.ts:130](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L130)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object` \| `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)): `Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `texts`      | `string`[]                                                  |
| `metadatas`  | `object` \| `object`[]                                      |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`   | [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)       |

#### Returns

`Promise`<[`SupabaseVectorStore`](SupabaseVectorStore.md)\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/supabase.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/supabase.ts#L102)
