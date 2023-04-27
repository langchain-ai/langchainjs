---
title: "SemanticSimilarityExampleSelector"
---

# SemanticSimilarityExampleSelector

Base class for example selectors.

## Implements

- [`BaseExampleSelector`](BaseExampleSelector.md)

## Constructors

### constructor()

> **new SemanticSimilarityExampleSelector**(`data`: [`SemanticSimilarityExampleSelectorInput`](../interfaces/SemanticSimilarityExampleSelectorInput.md)): [`SemanticSimilarityExampleSelector`](SemanticSimilarityExampleSelector.md)

#### Parameters

| Parameter | Type                                                                                                |
| :-------- | :-------------------------------------------------------------------------------------------------- |
| `data`    | [`SemanticSimilarityExampleSelectorInput`](../interfaces/SemanticSimilarityExampleSelectorInput.md) |

#### Returns

[`SemanticSimilarityExampleSelector`](SemanticSimilarityExampleSelector.md)

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L29)

## Properties

### k

> **k**: `number` = `4`

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L23)

### vectorStore

> **vectorStore**: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L21)

### exampleKeys?

> **exampleKeys**: `string`[]

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L25)

### inputKeys?

> **inputKeys**: `string`[]

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L27)

## Methods

### addExample()

> **addExample**(`example`: [`Example`](../../schema/types/Example.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                       |
| :-------- | :----------------------------------------- |
| `example` | [`Example`](../../schema/types/Example.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[BaseExampleSelector](BaseExampleSelector.md).[addExample](BaseExampleSelector.md#addexample)

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L36)

### selectExamples()

> **selectExamples**<T\>(`inputVariables`: `Record`<`string`, `T`\>): `Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Type parameters

- `T`

#### Parameters

| Parameter        | Type                      |
| :--------------- | :------------------------ |
| `inputVariables` | `Record`<`string`, `T`\> |

#### Returns

`Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Implementation of

[BaseExampleSelector](BaseExampleSelector.md).[selectExamples](BaseExampleSelector.md#selectexamples)

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L53)

### fromExamples()

> `Static` **fromExamples**<C\>(`examples`: `Record`<`string`, `string`\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `vectorStoreCls`: `C`, `options`: \{`inputKeys`?: `string`[];
> `k`?: `number`;} & `Parameters`<`C`["fromTexts"]\>[3] = `{}`): `Promise`<[`SemanticSimilarityExampleSelector`](SemanticSimilarityExampleSelector.md)\>

#### Type parameters

- `C` _extends_ _typeof_ [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Parameters

| Parameter        | Type                                                                                    |
| :--------------- | :-------------------------------------------------------------------------------------- |
| `examples`       | `Record`<`string`, `string`\>[]                                                        |
| `embeddings`     | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                             |
| `vectorStoreCls` | `C`                                                                                     |
| `options`        | \{`inputKeys`?: `string`[];<br />`k`?: `number`;} & `Parameters`<`C`["fromTexts"]\>[3] |

#### Returns

`Promise`<[`SemanticSimilarityExampleSelector`](SemanticSimilarityExampleSelector.md)\>

#### Defined in

[langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/SemanticSimilarityExampleSelector.ts#L79)
