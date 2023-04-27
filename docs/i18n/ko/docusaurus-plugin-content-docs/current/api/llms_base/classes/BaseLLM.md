---
title: "BaseLLM"
---

# BaseLLM

LLM Wrapper. Provides an [call](BaseLLM.md#call) (an [generate](BaseLLM.md#generate)) function that takes in a prompt (or prompts) and returns a string.

## Hierarchy

- [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md).**BaseLLM**

## Constructors

### constructor()

> **new BaseLLM**(«destructured»: [`BaseLLMParams`](../interfaces/BaseLLMParams.md)): [`BaseLLM`](BaseLLM.md)

#### Parameters

| Parameter        | Type                                              |
| :--------------- | :------------------------------------------------ |
| `«destructured»` | [`BaseLLMParams`](../interfaces/BaseLLMParams.md) |

#### Returns

[`BaseLLM`](BaseLLM.md)

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[constructor](../../base_language/classes/BaseLanguageModel.md#constructor)

#### Defined in

[langchain/src/llms/base.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L44)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[CallOptions](../../base_language/classes/BaseLanguageModel.md#calloptions)

#### Defined in

[langchain/src/llms/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L40)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[caller](../../base_language/classes/BaseLanguageModel.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[verbose](../../base_language/classes/BaseLanguageModel.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[callbacks](../../base_language/classes/BaseLanguageModel.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_generate()

Run the LLM on the given prompts and input.

> `Abstract` **\_generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `prompts`     | `string`[]                                                                                                     |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Defined in

[langchain/src/llms/base.ts:69](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L69)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_identifyingParams](../../base_language/classes/BaseLanguageModel.md#_identifyingparams)

#### Defined in

[langchain/src/llms/base.ts:177](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L177)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> `Abstract` **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_llmType](../../base_language/classes/BaseLanguageModel.md#_llmtype)

#### Defined in

[langchain/src/llms/base.ts:184](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L184)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_modelType](../../base_language/classes/BaseLanguageModel.md#_modeltype)

#### Defined in

[langchain/src/llms/base.ts:197](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L197)

### call()

Convenience wrapper for [generate](BaseLLM.md#generate) that takes in a single string prompt and returns a single string output.

> **call**(`prompt`: `string`, `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| `prompt`     | `string`                                                                                                       |
| `stop?`      | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/llms/base.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L164)

### generate()

Run the LLM on the given propmts an input, handling caching.

> **generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter    | Type                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| `prompts`    | `string`[]                                                                                                     |
| `stop?`      | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Defined in

[langchain/src/llms/base.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L112)

### generatePrompt()

> **generatePrompt**(`promptValues`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter      | Type                                                                                                           |
| :------------- | :------------------------------------------------------------------------------------------------------------- |
| `promptValues` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[]                                                 |
| `stop?`        | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?`   | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[generatePrompt](../../base_language/classes/BaseLanguageModel.md#generateprompt)

#### Defined in

[langchain/src/llms/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L55)

### getNumTokens()

> **getNumTokens**(`text`: `string`): `Promise`<`number`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`number`\>

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[getNumTokens](../../base_language/classes/BaseLanguageModel.md#getnumtokens)

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../types/SerializedLLM.md)

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[serialize](../../base_language/classes/BaseLanguageModel.md#serialize)

#### Defined in

[langchain/src/llms/base.ts:189](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L189)

### deserialize()

Load an LLM from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLM`](../types/SerializedLLM.md)): `Promise`<[`BaseLLM`](BaseLLM.md)\>

#### Parameters

| Parameter | Type                                         |
| :-------- | :------------------------------------------- |
| `data`    | [`SerializedLLM`](../types/SerializedLLM.md) |

#### Returns

`Promise`<[`BaseLLM`](BaseLLM.md)\>

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[deserialize](../../base_language/classes/BaseLanguageModel.md#deserialize)

#### Defined in

[langchain/src/llms/base.ts:204](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L204)
