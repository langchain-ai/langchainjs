---
title: "Embeddings"
---

# Embeddings

## Hierarchy

- [`FakeEmbeddings`](../../embeddings_fake/classes/FakeEmbeddings.md)
- [`OpenAIEmbeddings`](../../embeddings_openai/classes/OpenAIEmbeddings.md)
- [`CohereEmbeddings`](../../embeddings_cohere/classes/CohereEmbeddings.md)

## Constructors

### constructor()

> **new Embeddings**(`params`: `AsyncCallerParams`): [`Embeddings`](Embeddings.md)

#### Parameters

| Parameter | Type                |
| :-------- | :------------------ |
| `params`  | `AsyncCallerParams` |

#### Returns

[`Embeddings`](Embeddings.md)

#### Defined in

[langchain/src/embeddings/base.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L12)

## Properties

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Defined in

[langchain/src/embeddings/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L10)

## Methods

### embedDocuments()

> `Abstract` **embedDocuments**(`documents`: `string`[]): `Promise`<`number`[][]\>

#### Parameters

| Parameter   | Type       |
| :---------- | :--------- |
| `documents` | `string`[] |

#### Returns

`Promise`<`number`[][]\>

#### Defined in

[langchain/src/embeddings/base.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L16)

### embedQuery()

> `Abstract` **embedQuery**(`document`: `string`): `Promise`<`number`[]\>

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `document` | `string` |

#### Returns

`Promise`<`number`[]\>

#### Defined in

[langchain/src/embeddings/base.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L18)
