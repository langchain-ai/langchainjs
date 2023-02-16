---
id: "vectorstores.HNSWLib"
title: "Class: HNSWLib"
sidebar_label: "HNSWLib"
custom_edit_url: null
---

[vectorstores](../modules/vectorstores.md).HNSWLib

## Hierarchy

- [`SaveableVectorStore`](vectorstores.internal.SaveableVectorStore.md)

  ↳ **`HNSWLib`**

## Constructors

### constructor

• **new HNSWLib**(`args`, `embeddings`, `docstore`, `index?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | [`HNSWLibArgs`](../interfaces/vectorstores.internal.HNSWLibArgs.md) |
| `embeddings` | [`Embeddings`](embeddings.internal.Embeddings.md) |
| `docstore` | [`DocStore`](../interfaces/vectorstores.internal.DocStore.md) |
| `index?` | `HierarchicalNSW` |

#### Overrides

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[constructor](vectorstores.internal.SaveableVectorStore.md#constructor)

#### Defined in

[vectorstores/hnswlib.ts:31](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L31)

## Properties

### args

• **args**: [`HNSWLibArgs`](../interfaces/vectorstores.internal.HNSWLibArgs.md)

#### Defined in

[vectorstores/hnswlib.ts:29](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L29)

___

### docstore

• **docstore**: [`DocStore`](../interfaces/vectorstores.internal.DocStore.md)

#### Inherited from

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[docstore](vectorstores.internal.SaveableVectorStore.md#docstore)

#### Defined in

[vectorstores/base.ts:11](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L11)

___

### embeddings

• **embeddings**: [`Embeddings`](embeddings.internal.Embeddings.md)

#### Inherited from

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[embeddings](vectorstores.internal.SaveableVectorStore.md#embeddings)

#### Defined in

[vectorstores/base.ts:9](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L9)

___

### index

• `Optional` **index**: `HierarchicalNSW`

#### Defined in

[vectorstores/hnswlib.ts:27](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L27)

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

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[addTexts](vectorstores.internal.SaveableVectorStore.md#addtexts)

#### Defined in

[vectorstores/base.ts:20](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L20)

___

### addVectors

▸ **addVectors**(`vectors`, `metadatas`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `vectors` | `number`[][] |
| `metadatas` | `object`[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[addVectors](vectorstores.internal.SaveableVectorStore.md#addvectors)

#### Defined in

[vectorstores/hnswlib.ts:44](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L44)

___

### save

▸ **save**(`directory`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `directory` | `string` |

#### Returns

`Promise`<`void`\>

#### Overrides

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[save](vectorstores.internal.SaveableVectorStore.md#save)

#### Defined in

[vectorstores/hnswlib.ts:102](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L102)

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

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[similaritySearch](vectorstores.internal.SaveableVectorStore.md#similaritysearch)

#### Defined in

[vectorstores/base.ts:27](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L27)

___

### similaritySearchVectorWithScore

▸ **similaritySearchVectorWithScore**(`query`, `k`): `Promise`<[`object`, `number`][]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `query` | `number`[] |
| `k` | `number` |

#### Returns

`Promise`<[`object`, `number`][]\>

#### Overrides

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[similaritySearchVectorWithScore](vectorstores.internal.SaveableVectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[vectorstores/hnswlib.ts:86](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L86)

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

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[similaritySearchWithScore](vectorstores.internal.SaveableVectorStore.md#similaritysearchwithscore)

#### Defined in

[vectorstores/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L36)

___

### fromTexts

▸ `Static` **fromTexts**(`texts`, `metadatas`, `embeddings`): `Promise`<[`HNSWLib`](vectorstores.HNSWLib.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `texts` | `string`[] |
| `metadatas` | `object`[] |
| `embeddings` | [`Embeddings`](embeddings.internal.Embeddings.md) |

#### Returns

`Promise`<[`HNSWLib`](vectorstores.HNSWLib.md)\>

#### Defined in

[vectorstores/hnswlib.ts:142](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L142)

___

### load

▸ `Static` **load**(`directory`, `embeddings`): `Promise`<[`HNSWLib`](vectorstores.HNSWLib.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `directory` | `string` |
| `embeddings` | [`Embeddings`](embeddings.internal.Embeddings.md) |

#### Returns

`Promise`<[`HNSWLib`](vectorstores.HNSWLib.md)\>

#### Overrides

[SaveableVectorStore](vectorstores.internal.SaveableVectorStore.md).[load](vectorstores.internal.SaveableVectorStore.md#load)

#### Defined in

[vectorstores/hnswlib.ts:122](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/hnswlib.ts#L122)
