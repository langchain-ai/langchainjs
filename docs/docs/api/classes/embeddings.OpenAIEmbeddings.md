---
id: "embeddings.OpenAIEmbeddings"
title: "Class: OpenAIEmbeddings"
sidebar_label: "OpenAIEmbeddings"
custom_edit_url: null
---

[embeddings](../modules/embeddings.md).OpenAIEmbeddings

## Hierarchy

- [`Embeddings`](embeddings.internal.Embeddings.md)

  ↳ **`OpenAIEmbeddings`**

## Implements

- [`ModelParams`](../interfaces/embeddings.internal.ModelParams.md)

## Constructors

### constructor

• **new OpenAIEmbeddings**(`fields?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields?` | `Partial`<[`ModelParams`](../interfaces/embeddings.internal.ModelParams.md)\> & { `batchSize?`: `number` ; `maxRetries?`: `number` ; `openAIApiKey?`: `string` ; `verbose?`: `boolean`  } |

#### Overrides

[Embeddings](embeddings.internal.Embeddings.md).[constructor](embeddings.internal.Embeddings.md#constructor)

#### Defined in

[embeddings/openai.ts:33](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L33)

## Properties

### batchSize

• **batchSize**: `number` = `20`

#### Defined in

[embeddings/openai.ts:27](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L27)

___

### client

• `Private` **client**: `OpenAIApi`

#### Defined in

[embeddings/openai.ts:31](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L31)

___

### maxRetries

• **maxRetries**: `number` = `6`

#### Defined in

[embeddings/openai.ts:29](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L29)

___

### modelName

• **modelName**: `string` = `"text-embedding-ada-002"`

#### Implementation of

[ModelParams](../interfaces/embeddings.internal.ModelParams.md).[modelName](../interfaces/embeddings.internal.ModelParams.md#modelname)

#### Defined in

[embeddings/openai.ts:25](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L25)

## Methods

### embedDocuments

▸ **embedDocuments**(`texts`): `Promise`<`number`[][]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `texts` | `string`[] |

#### Returns

`Promise`<`number`[][]\>

#### Overrides

[Embeddings](embeddings.internal.Embeddings.md).[embedDocuments](embeddings.internal.Embeddings.md#embeddocuments)

#### Defined in

[embeddings/openai.ts:56](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L56)

___

### embedQuery

▸ **embedQuery**(`text`): `Promise`<`number`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

`Promise`<`number`[]\>

#### Overrides

[Embeddings](embeddings.internal.Embeddings.md).[embedQuery](embeddings.internal.Embeddings.md#embedquery)

#### Defined in

[embeddings/openai.ts:75](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L75)

___

### embeddingWithRetry

▸ `Private` **embeddingWithRetry**(`request`): `Promise`<`AxiosResponse`<`CreateEmbeddingResponse`, `any`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `request` | `CreateEmbeddingRequest` |

#### Returns

`Promise`<`AxiosResponse`<`CreateEmbeddingResponse`, `any`\>\>

#### Defined in

[embeddings/openai.ts:83](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/embeddings/openai.ts#L83)
