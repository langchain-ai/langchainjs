---
title: "SupabaseHybridSearch"
---

# SupabaseHybridSearch

Base Index class. All indexes should extend this class.

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**SupabaseHybridSearch**

## Constructors

### constructor()

> **new SupabaseHybridSearch**(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `args`: [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)): [`SupabaseHybridSearch`](SupabaseHybridSearch.md)

#### Parameters

| Parameter    | Type                                                        |
| :----------- | :---------------------------------------------------------- |
| `embeddings` | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `args`       | [`SupabaseLibArgs`](../interfaces/SupabaseLibArgs.md)       |

#### Returns

[`SupabaseHybridSearch`](SupabaseHybridSearch.md)

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/supabase.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L72)

## Properties

### client

> **client**: `default`<`any`, "public", `any`\>

#### Defined in

[langchain/src/retrievers/supabase.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L64)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Defined in

[langchain/src/retrievers/supabase.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L70)

### keywordK

> **keywordK**: `number`

#### Defined in

[langchain/src/retrievers/supabase.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L60)

### keywordQueryName

> **keywordQueryName**: `string`

#### Defined in

[langchain/src/retrievers/supabase.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L68)

### query

> **query**: `string`

#### Defined in

[langchain/src/retrievers/supabase.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L58)

### similarityK

> **similarityK**: `number`

#### Defined in

[langchain/src/retrievers/supabase.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L56)

### similarityQueryName

> **similarityQueryName**: `string`

#### Defined in

[langchain/src/retrievers/supabase.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L62)

### tableName

> **tableName**: `string`

#### Defined in

[langchain/src/retrievers/supabase.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L66)

## Methods

### getRelevantDocuments()

> **getRelevantDocuments**(`query`: `string`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[getRelevantDocuments](../../schema/classes/BaseRetriever.md#getrelevantdocuments)

#### Defined in

[langchain/src/retrievers/supabase.ts:174](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L174)

### hybridSearch()

> `Protected` **hybridSearch**(`query`: `string`, `similarityK`: `number`, `keywordK`: `number`): `Promise`<`SearchResult`[]\>

#### Parameters

| Parameter     | Type     |
| :------------ | :------- |
| `query`       | `string` |
| `similarityK` | `number` |
| `keywordK`    | `number` |

#### Returns

`Promise`<`SearchResult`[]\>

#### Defined in

[langchain/src/retrievers/supabase.ts:145](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L145)

### keywordSearch()

> `Protected` **keywordSearch**(`query`: `string`, `k`: `number`): `Promise`<`SearchResult`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |
| `k`       | `number` |

#### Returns

`Promise`<`SearchResult`[]\>

#### Defined in

[langchain/src/retrievers/supabase.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L115)

### similaritySearch()

> `Protected` **similaritySearch**(`query`: `string`, `k`: `number`): `Promise`<`SearchResult`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |
| `k`       | `number` |

#### Returns

`Promise`<`SearchResult`[]\>

#### Defined in

[langchain/src/retrievers/supabase.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L83)
