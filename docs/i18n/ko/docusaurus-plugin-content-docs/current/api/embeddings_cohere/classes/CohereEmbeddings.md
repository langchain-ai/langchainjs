---
title: "CohereEmbeddings"
---

# CohereEmbeddings

A class for generating embeddings using the Cohere API.

## Hierarchy

- [`Embeddings`](../../embeddings_base/classes/Embeddings.md).**CohereEmbeddings**

## Implements

- [`CohereEmbeddingsParams`](../interfaces/CohereEmbeddingsParams.md)

## Constructors

### constructor()

Constructor for the CohereEmbeddings class.

> **new CohereEmbeddings**(`fields`?: `Partial`<[`CohereEmbeddingsParams`](../interfaces/CohereEmbeddingsParams.md)\> & \{`apiKey`?: `string`;
> `verbose`?: `boolean`;}): [`CohereEmbeddings`](CohereEmbeddings.md)

#### Parameters

| Parameter | Type                                                                                                                                   | Description                                                   |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `fields?` | `Partial`<[`CohereEmbeddingsParams`](../interfaces/CohereEmbeddingsParams.md)\> & \{`apiKey`?: `string`;<br />`verbose`?: `boolean`;} | An optional object with properties to configure the instance. |

#### Returns

[`CohereEmbeddings`](CohereEmbeddings.md)

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[constructor](../../embeddings_base/classes/Embeddings.md#constructor)

#### Defined in

[langchain/src/embeddings/cohere.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L33)

## Properties

### batchSize

> **batchSize**: `number` = `48`

The maximum number of documents to embed in a single request. This is
limited by the Cohere API to a maximum of 96.

#### Implementation of

[CohereEmbeddingsParams](../interfaces/CohereEmbeddingsParams.md).[batchSize](../interfaces/CohereEmbeddingsParams.md#batchsize)

#### Defined in

[langchain/src/embeddings/cohere.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L23)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[Embeddings](../../embeddings_base/classes/Embeddings.md).[caller](../../embeddings_base/classes/Embeddings.md#caller)

#### Defined in

[langchain/src/embeddings/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L10)

### modelName

> **modelName**: `string` = `"small"`

#### Implementation of

[CohereEmbeddingsParams](../interfaces/CohereEmbeddingsParams.md).[modelName](../interfaces/CohereEmbeddingsParams.md#modelname)

#### Defined in

[langchain/src/embeddings/cohere.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L21)

## Methods

### embedDocuments()

Generates embeddings for an array of texts.

> **embedDocuments**(`texts`: `string`[]): `Promise`<`number`[][]\>

#### Parameters

| Parameter | Type       | Description                                     |
| :-------- | :--------- | :---------------------------------------------- |
| `texts`   | `string`[] | An array of strings to generate embeddings for. |

#### Returns

`Promise`<`number`[][]\>

A Promise that resolves to an array of embeddings.

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedDocuments](../../embeddings_base/classes/Embeddings.md#embeddocuments)

#### Defined in

[langchain/src/embeddings/cohere.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L62)

### embedQuery()

Generates an embedding for a single text.

> **embedQuery**(`text`: `string`): `Promise`<`number`[]\>

#### Parameters

| Parameter | Type     | Description                            |
| :-------- | :------- | :------------------------------------- |
| `text`    | `string` | A string to generate an embedding for. |

#### Returns

`Promise`<`number`[]\>

A Promise that resolves to an array of numbers representing the embedding.

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedQuery](../../embeddings_base/classes/Embeddings.md#embedquery)

#### Defined in

[langchain/src/embeddings/cohere.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/cohere.ts#L88)
