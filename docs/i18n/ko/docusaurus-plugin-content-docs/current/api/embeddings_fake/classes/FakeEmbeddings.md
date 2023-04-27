---
title: "FakeEmbeddings"
---

# FakeEmbeddings

## Hierarchy

- [`Embeddings`](../../embeddings_base/classes/Embeddings.md).**FakeEmbeddings**

## Constructors

### constructor()

> **new FakeEmbeddings**(`params`?: `AsyncCallerParams`): [`FakeEmbeddings`](FakeEmbeddings.md)

#### Parameters

| Parameter | Type                |
| :-------- | :------------------ |
| `params?` | `AsyncCallerParams` |

#### Returns

[`FakeEmbeddings`](FakeEmbeddings.md)

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[constructor](../../embeddings_base/classes/Embeddings.md#constructor)

#### Defined in

[langchain/src/embeddings/fake.ts:4](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/fake.ts#L4)

## Properties

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[Embeddings](../../embeddings_base/classes/Embeddings.md).[caller](../../embeddings_base/classes/Embeddings.md#caller)

#### Defined in

[langchain/src/embeddings/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L10)

## Methods

### embedDocuments()

> **embedDocuments**(`documents`: `string`[]): `Promise`<`number`[][]\>

#### Parameters

| Parameter   | Type       |
| :---------- | :--------- |
| `documents` | `string`[] |

#### Returns

`Promise`<`number`[][]\>

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedDocuments](../../embeddings_base/classes/Embeddings.md#embeddocuments)

#### Defined in

[langchain/src/embeddings/fake.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/fake.ts#L8)

### embedQuery()

> **embedQuery**(`_`: `string`): `Promise`<`number`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `_`       | `string` |

#### Returns

`Promise`<`number`[]\>

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedQuery](../../embeddings_base/classes/Embeddings.md#embedquery)

#### Defined in

[langchain/src/embeddings/fake.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/fake.ts#L12)
