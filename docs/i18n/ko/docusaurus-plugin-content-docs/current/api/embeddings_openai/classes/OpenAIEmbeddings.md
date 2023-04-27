---
title: "OpenAIEmbeddings"
---

# OpenAIEmbeddings

## Hierarchy

- [`Embeddings`](../../embeddings_base/classes/Embeddings.md).**OpenAIEmbeddings**

## Implements

- [`OpenAIEmbeddingsParams`](../interfaces/OpenAIEmbeddingsParams.md)

## Constructors

### constructor()

> **new OpenAIEmbeddings**(`fields`?: `Partial`<[`OpenAIEmbeddingsParams`](../interfaces/OpenAIEmbeddingsParams.md)\> & \{`openAIApiKey`?: `string`;
> `verbose`?: `boolean`;}, `configuration`?: `ConfigurationParameters`): [`OpenAIEmbeddings`](OpenAIEmbeddings.md)

#### Parameters

| Parameter        | Type                                                                                                                                         |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields?`        | `Partial`<[`OpenAIEmbeddingsParams`](../interfaces/OpenAIEmbeddingsParams.md)\> & \{`openAIApiKey`?: `string`;<br />`verbose`?: `boolean`;} |
| `configuration?` | `ConfigurationParameters`                                                                                                                    |

#### Returns

[`OpenAIEmbeddings`](OpenAIEmbeddings.md)

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[constructor](../../embeddings_base/classes/Embeddings.md#constructor)

#### Defined in

[langchain/src/embeddings/openai.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L49)

## Properties

### batchSize

> **batchSize**: `number` = `512`

The maximum number of documents to embed in a single request. This is
limited by the OpenAI API to a maximum of 2048.

#### Implementation of

[OpenAIEmbeddingsParams](../interfaces/OpenAIEmbeddingsParams.md).[batchSize](../interfaces/OpenAIEmbeddingsParams.md#batchsize)

#### Defined in

[langchain/src/embeddings/openai.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L39)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[Embeddings](../../embeddings_base/classes/Embeddings.md).[caller](../../embeddings_base/classes/Embeddings.md#caller)

#### Defined in

[langchain/src/embeddings/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/base.ts#L10)

### modelName

> **modelName**: `string` = `"text-embedding-ada-002"`

Model name to use

#### Implementation of

[OpenAIEmbeddingsParams](../interfaces/OpenAIEmbeddingsParams.md).[modelName](../interfaces/OpenAIEmbeddingsParams.md#modelname)

#### Defined in

[langchain/src/embeddings/openai.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L37)

### stripNewLines

> **stripNewLines**: `boolean` = `true`

Whether to strip new lines from the input text. This is recommended by
OpenAI, but may not be suitable for all use cases.

#### Implementation of

[OpenAIEmbeddingsParams](../interfaces/OpenAIEmbeddingsParams.md).[stripNewLines](../interfaces/OpenAIEmbeddingsParams.md#stripnewlines)

#### Defined in

[langchain/src/embeddings/openai.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L41)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Implementation of

[OpenAIEmbeddingsParams](../interfaces/OpenAIEmbeddingsParams.md).[timeout](../interfaces/OpenAIEmbeddingsParams.md#timeout)

#### Defined in

[langchain/src/embeddings/openai.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L43)

## Methods

### embedDocuments()

> **embedDocuments**(`texts`: `string`[]): `Promise`<`number`[][]\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `texts`   | `string`[] |

#### Returns

`Promise`<`number`[][]\>

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedDocuments](../../embeddings_base/classes/Embeddings.md#embeddocuments)

#### Defined in

[langchain/src/embeddings/openai.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L77)

### embedQuery()

> **embedQuery**(`text`: `string`): `Promise`<`number`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`number`[]\>

#### Overrides

[Embeddings](../../embeddings_base/classes/Embeddings.md).[embedQuery](../../embeddings_base/classes/Embeddings.md#embedquery)

#### Defined in

[langchain/src/embeddings/openai.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/embeddings/openai.ts#L99)
