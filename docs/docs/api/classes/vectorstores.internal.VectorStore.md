---
id: "vectorstores.internal.VectorStore"
title: "Class: VectorStore"
sidebar_label: "VectorStore"
custom_edit_url: null
---

[vectorstores](../modules/vectorstores.md).[internal](../modules/vectorstores.internal.md).VectorStore

## Hierarchy

- **`VectorStore`**

  ↳ [`SaveableVectorStore`](vectorstores.internal.SaveableVectorStore.md)

## Constructors

### constructor

• **new VectorStore**()

## Properties

### docstore

• **docstore**: [`DocStore`](../interfaces/vectorstores.internal.DocStore.md)

#### Defined in

[vectorstores/base.ts:11](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L11)

___

### embeddings

• **embeddings**: [`Embeddings`](embeddings.internal.Embeddings.md)

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

#### Defined in

[vectorstores/base.ts:13](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L13)

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

#### Defined in

[vectorstores/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/vectorstores/base.ts#L36)
