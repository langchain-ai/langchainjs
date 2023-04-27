---
title: "MetalRetriever"
---

# MetalRetriever

Base Index class. All indexes should extend this class.

## Hierarchy

- [`BaseRetriever`](../../schema/classes/BaseRetriever.md).**MetalRetriever**

## Constructors

### constructor()

> **new MetalRetriever**(`fields`: [`MetalRetrieverFields`](../interfaces/MetalRetrieverFields.md)): [`MetalRetriever`](MetalRetriever.md)

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `fields`  | [`MetalRetrieverFields`](../interfaces/MetalRetrieverFields.md) |

#### Returns

[`MetalRetriever`](MetalRetriever.md)

#### Overrides

[BaseRetriever](../../schema/classes/BaseRetriever.md).[constructor](../../schema/classes/BaseRetriever.md#constructor)

#### Defined in

[langchain/src/retrievers/metal.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/metal.ts#L16)

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

[langchain/src/retrievers/metal.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/metal.ts#L22)
