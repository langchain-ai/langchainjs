---
title: "BaseRetriever"
---

# BaseRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)
- [`SupabaseHybridSearch`](../../retrievers_supabase/classes/SupabaseHybridSearch.md)
- [`MetalRetriever`](../../retrievers_metal/classes/MetalRetriever.md)
- [`DataberryRetriever`](../../retrievers_databerry/classes/DataberryRetriever.md)
- [`ContextualCompressionRetriever`](../../retrievers_contextual_compression/classes/ContextualCompressionRetriever.md)
- [`RemoteRetriever`](../../retrievers_remote/classes/RemoteRetriever.md)

## Constructors

### constructor()

> **new BaseRetriever**(): [`BaseRetriever`](BaseRetriever.md)

#### Returns

[`BaseRetriever`](BaseRetriever.md)

## Methods

### getRelevantDocuments()

> `Abstract` **getRelevantDocuments**(`query`: `string`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `query`   | `string` |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/schema/index.ts:141](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L141)
