---
id: "embeddings.internal.Embeddings"
title: "Class: Embeddings"
sidebar_label: "Embeddings"
custom_edit_url: null
---

[embeddings](../modules/embeddings.md).[internal](../modules/embeddings.internal.md).Embeddings

## Hierarchy

- **`Embeddings`**

  ↳ [`OpenAIEmbeddings`](embeddings.OpenAIEmbeddings.md)

## Constructors

### constructor

• **new Embeddings**()

## Methods

### embedDocuments

▸ `Abstract` **embedDocuments**(`documents`): `Promise`<`number`[][]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `documents` | `string`[] |

#### Returns

`Promise`<`number`[][]\>

#### Defined in

[embeddings/base.ts:2](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/embeddings/base.ts#L2)

___

### embedQuery

▸ `Abstract` **embedQuery**(`document`): `Promise`<`number`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `document` | `string` |

#### Returns

`Promise`<`number`[]\>

#### Defined in

[embeddings/base.ts:4](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/embeddings/base.ts#L4)
