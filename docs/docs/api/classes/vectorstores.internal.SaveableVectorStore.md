---
id: "vectorstores.internal.SaveableVectorStore"
title: "Class: SaveableVectorStore"
sidebar_label: "SaveableVectorStore"
custom_edit_url: null
---

[vectorstores](../modules/vectorstores.md).[internal](../modules/vectorstores.internal.md).SaveableVectorStore

## Hierarchy

- [`VectorStore`](vectorstores.internal.VectorStore.md)

  ↳ **`SaveableVectorStore`**

  ↳↳ [`HNSWLib`](vectorstores.HNSWLib.md)

## Constructors

### constructor

• **new SaveableVectorStore**()

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[constructor](vectorstores.internal.VectorStore.md#constructor)

## Properties

### docstore

• **docstore**: [`DocStore`](../interfaces/vectorstores.internal.DocStore.md)

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[docstore](vectorstores.internal.VectorStore.md#docstore)

#### Defined in

[vectorstores/base.ts:11](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L11)

___

### embeddings

• **embeddings**: [`Embeddings`](embeddings.internal.Embeddings.md)

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[embeddings](vectorstores.internal.VectorStore.md#embeddings)

#### Defined in

[vectorstores/base.ts:9](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L9)

## Methods

### addTexts

▸ **addTexts**(`texts`, `metadatas`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `texts` | `string`[] |
| `metadatas` | `object`[] |

#### Returns

`Promise`<`void`\>

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[addTexts](vectorstores.internal.VectorStore.md#addtexts)

#### Defined in

[vectorstores/base.ts:20](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L20)

___

### addVectors

▸ `Abstract` **addVectors**(`vectors`, `metadatas`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `vectors` | `number`[][] |
| `metadatas` | `object`[] |

#### Returns

`Promise`<`void`\>

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[addVectors](vectorstores.internal.VectorStore.md#addvectors)

#### Defined in

[vectorstores/base.ts:13](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L13)

___

### save

▸ `Abstract` **save**(`directory`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `directory` | `string` |

#### Returns

`Promise`<`void`\>

#### Defined in

[vectorstores/base.ts:48](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L48)

___

### similaritySearch

▸ **similaritySearch**(`query`, `k?`): `Promise`<`object`[]\>

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `query` | `string` | `undefined` |
| `k` | `number` | `4` |

#### Returns

`Promise`<`object`[]\>

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[similaritySearch](vectorstores.internal.VectorStore.md#similaritysearch)

#### Defined in

[vectorstores/base.ts:27](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L27)

___

### similaritySearchVectorWithScore

▸ `Abstract` **similaritySearchVectorWithScore**(`query`, `k`): `Promise`<[`object`, `number`][]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `query` | `number`[] |
| `k` | `number` |

#### Returns

`Promise`<[`object`, `number`][]\>

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[similaritySearchVectorWithScore](vectorstores.internal.VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[vectorstores/base.ts:15](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L15)

___

### similaritySearchWithScore

▸ **similaritySearchWithScore**(`query`, `k?`): `Promise`<[`object`, `number`][]\>

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `query` | `string` | `undefined` |
| `k` | `number` | `4` |

#### Returns

`Promise`<[`object`, `number`][]\>

#### Inherited from

[VectorStore](vectorstores.internal.VectorStore.md).[similaritySearchWithScore](vectorstores.internal.VectorStore.md#similaritysearchwithscore)

#### Defined in

[vectorstores/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L36)

___

### load

▸ `Static` **load**(`_directory`, `_embeddings`): `Promise`<[`SaveableVectorStore`](vectorstores.internal.SaveableVectorStore.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_directory` | `string` |
| `_embeddings` | [`Embeddings`](embeddings.internal.Embeddings.md) |

#### Returns

`Promise`<[`SaveableVectorStore`](vectorstores.internal.SaveableVectorStore.md)\>

#### Defined in

[vectorstores/base.ts:50](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L50)
