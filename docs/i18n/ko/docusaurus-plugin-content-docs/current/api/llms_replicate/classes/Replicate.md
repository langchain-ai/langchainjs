---
title: "Replicate"
---

# Replicate

LLM class that provides a simpler interface to subclass than [BaseLLM](../../llms_base/classes/BaseLLM.md).

Requires only implementing a simpler [\_call](../../llms_base/classes/LLM.md#_call) method instead of [\_generate](../../llms_base/classes/LLM.md#_generate).

## Hierarchy

- [`LLM`](../../llms_base/classes/LLM.md).**Replicate**

## Implements

- [`ReplicateInput`](../interfaces/ReplicateInput.md)

## Constructors

### constructor()

> **new Replicate**(`fields`: [`ReplicateInput`](../interfaces/ReplicateInput.md) & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md)): [`Replicate`](Replicate.md)

#### Parameters

| Parameter | Type                                                                                                                 |
| :-------- | :------------------------------------------------------------------------------------------------------------------- |
| `fields`  | [`ReplicateInput`](../interfaces/ReplicateInput.md) & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) |

#### Returns

[`Replicate`](Replicate.md)

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[constructor](../../llms_base/classes/LLM.md#constructor)

#### Defined in

[langchain/src/llms/replicate.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/replicate.ts#L22)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[CallOptions](../../llms_base/classes/LLM.md#calloptions)

#### Defined in

[langchain/src/llms/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L40)

### apiKey

> **apiKey**: `string`

#### Implementation of

[ReplicateInput](../interfaces/ReplicateInput.md).[apiKey](../interfaces/ReplicateInput.md#apikey)

#### Defined in

[langchain/src/llms/replicate.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/replicate.ts#L20)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[caller](../../llms_base/classes/LLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### input

> **input**: `undefined` \| \{}

#### Implementation of

[ReplicateInput](../interfaces/ReplicateInput.md).[input](../interfaces/ReplicateInput.md#input)

#### Defined in

[langchain/src/llms/replicate.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/replicate.ts#L18)

### model

> **model**: \`$\{string}/$\{string}:$\{string}\`

#### Implementation of

[ReplicateInput](../interfaces/ReplicateInput.md).[model](../interfaces/ReplicateInput.md#model)

#### Defined in

[langchain/src/llms/replicate.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/replicate.ts#L16)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[verbose](../../llms_base/classes/LLM.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[cache](../../llms_base/classes/LLM.md#cache)

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[callbacks](../../llms_base/classes/LLM.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_generate()

Run the LLM on the given prompts and input.

> **\_generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `prompts`     | `string`[]                                                                                                     |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[\_generate](../../llms_base/classes/LLM.md#_generate)

#### Defined in

[langchain/src/llms/base.ts:236](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L236)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[\_identifyingParams](../../llms_base/classes/LLM.md#_identifyingparams)

#### Defined in

[langchain/src/llms/base.ts:177](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L177)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[\_llmType](../../llms_base/classes/LLM.md#_llmtype)

#### Defined in

[langchain/src/llms/replicate.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/replicate.ts#L39)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[\_modelType](../../llms_base/classes/LLM.md#_modeltype)

#### Defined in

[langchain/src/llms/base.ts:197](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L197)

### call()

Convenience wrapper for [generate](../../llms_base/classes/BaseLLM.md#generate) that takes in a single string prompt and returns a single string output.

> **call**(`prompt`: `string`, `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| `prompt`     | `string`                                                                                                       |
| `stop?`      | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<`string`\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[call](../../llms_base/classes/LLM.md#call)

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

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[generate](../../llms_base/classes/LLM.md#generate)

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

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[generatePrompt](../../llms_base/classes/LLM.md#generateprompt)

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

[LLM](../../llms_base/classes/LLM.md).[getNumTokens](../../llms_base/classes/LLM.md#getnumtokens)

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[serialize](../../llms_base/classes/LLM.md#serialize)

#### Defined in

[langchain/src/llms/base.ts:189](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L189)

### deserialize()

Load an LLM from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLM`](../../llms_base/types/SerializedLLM.md)): `Promise`<[`BaseLLM`](../../llms_base/classes/BaseLLM.md)\>

#### Parameters

| Parameter | Type                                                      |
| :-------- | :-------------------------------------------------------- |
| `data`    | [`SerializedLLM`](../../llms_base/types/SerializedLLM.md) |

#### Returns

`Promise`<[`BaseLLM`](../../llms_base/classes/BaseLLM.md)\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[deserialize](../../llms_base/classes/LLM.md#deserialize)

#### Defined in

[langchain/src/llms/base.ts:204](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L204)
