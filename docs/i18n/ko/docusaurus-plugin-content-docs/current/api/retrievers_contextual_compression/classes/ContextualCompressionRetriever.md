---
title: "ContextualCompressionRetriever"
---

# ContextualCompressionRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**ContextualCompressionRetriever**

## Constructors

### constructor()

> **new ContextualCompressionRetriever**(«destructured»: [`ContextualCompressionRetrieverArgs`](../interfaces/ContextualCompressionRetrieverArgs.md)): [`ContextualCompressionRetriever`](ContextualCompressionRetriever.md)

#### Parameters

| Parameter        | Type                                                                                        |
| :--------------- | :------------------------------------------------------------------------------------------ |
| `«destructured»` | [`ContextualCompressionRetrieverArgs`](../interfaces/ContextualCompressionRetrieverArgs.md) |

#### Returns

[`ContextualCompressionRetriever`](ContextualCompressionRetriever.md)

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/contextual_compression.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/contextual_compression.ts#L15)

## Properties

### baseCompressor

> **baseCompressor**: [`BaseDocumentCompressor`](../../retrievers_document_compressors/classes/BaseDocumentCompressor.md)

#### Defined in

[langchain/src/retrievers/contextual_compression.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/contextual_compression.ts#L11)

### baseRetriever

> **baseRetriever**: [`BaseRetriever`](../../schema/classes/BaseRetriever.md)

#### Defined in

[langchain/src/retrievers/contextual_compression.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/contextual_compression.ts#L13)

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

[langchain/src/retrievers/contextual_compression.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/contextual_compression.ts#L25)
