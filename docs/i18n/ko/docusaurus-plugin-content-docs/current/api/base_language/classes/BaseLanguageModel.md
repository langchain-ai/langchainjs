---
title: "BaseLanguageModel"
---

# BaseLanguageModel

Base class for language models.

## Hierarchy

- [`BaseLangChain`](BaseLangChain.md).**BaseLanguageModel**

## Implements

- [`BaseLanguageModelParams`](../interfaces/BaseLanguageModelParams.md)

## Constructors

### constructor()

> **new BaseLanguageModel**(`params`: [`BaseLanguageModelParams`](../interfaces/BaseLanguageModelParams.md)): [`BaseLanguageModel`](BaseLanguageModel.md)

#### Parameters

| Parameter | Type                                                                  |
| :-------- | :-------------------------------------------------------------------- |
| `params`  | [`BaseLanguageModelParams`](../interfaces/BaseLanguageModelParams.md) |

#### Returns

[`BaseLanguageModel`](BaseLanguageModel.md)

#### Overrides

[BaseLangChain](BaseLangChain.md).[constructor](BaseLangChain.md#constructor)

#### Defined in

[langchain/src/base_language/index.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L68)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../interfaces/BaseLanguageModelCallOptions.md)

#### Defined in

[langchain/src/base_language/index.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L60)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[BaseLanguageModelParams](../interfaces/BaseLanguageModelParams.md).[verbose](../interfaces/BaseLanguageModelParams.md#verbose)

#### Inherited from

[BaseLangChain](BaseLangChain.md).[verbose](BaseLangChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[BaseLanguageModelParams](../interfaces/BaseLanguageModelParams.md).[callbacks](../interfaces/BaseLanguageModelParams.md#callbacks)

#### Inherited from

[BaseLangChain](BaseLangChain.md).[callbacks](BaseLangChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Defined in

[langchain/src/base_language/index.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L129)

### \_llmType()

> `Abstract` **\_llmType**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/base_language/index.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L84)

### \_modelType()

> `Abstract` **\_modelType**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/base_language/index.ts:82](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L82)

### generatePrompt()

> `Abstract` **generatePrompt**(`promptValues`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter      | Type                                                                                          |
| :------------- | :-------------------------------------------------------------------------------------------- |
| `promptValues` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[]                                |
| `stop?`        | `string`[] \| [`BaseLanguageModelCallOptions`](../interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?`   | [`Callbacks`](../../callbacks/types/Callbacks.md)                                             |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Defined in

[langchain/src/base_language/index.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L76)

### getNumTokens()

> **getNumTokens**(`text`: `string`): `Promise`<`number`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`number`\>

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../types/SerializedLLM.md)

#### Defined in

[langchain/src/base_language/index.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L136)

### deserialize()

Load an LLM from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLM`](../types/SerializedLLM.md)): `Promise`<[`BaseLanguageModel`](BaseLanguageModel.md)\>

#### Parameters

| Parameter | Type                                         |
| :-------- | :------------------------------------------- |
| `data`    | [`SerializedLLM`](../types/SerializedLLM.md) |

#### Returns

`Promise`<[`BaseLanguageModel`](BaseLanguageModel.md)\>

#### Defined in

[langchain/src/base_language/index.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L147)
