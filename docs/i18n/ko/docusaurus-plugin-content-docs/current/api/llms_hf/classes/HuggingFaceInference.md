---
title: "HuggingFaceInference"
---

# HuggingFaceInference

LLM class that provides a simpler interface to subclass than [BaseLLM](../../llms_base/classes/BaseLLM.md).

Requires only implementing a simpler [\_call](../../llms_base/classes/LLM.md#_call) method instead of [\_generate](../../llms_base/classes/LLM.md#_generate).

## Hierarchy

- [`LLM`](../../llms_base/classes/LLM.md).**HuggingFaceInference**

## Implements

- [`HFInput`](../interfaces/HFInput.md)

## Constructors

### constructor()

> **new HuggingFaceInference**(`fields`?: `Partial`<[`HFInput`](../interfaces/HFInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md)): [`HuggingFaceInference`](HuggingFaceInference.md)

#### Parameters

| Parameter | Type                                                                                                                |
| :-------- | :------------------------------------------------------------------------------------------------------------------ |
| `fields?` | `Partial`<[`HFInput`](../interfaces/HFInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) |

#### Returns

[`HuggingFaceInference`](HuggingFaceInference.md)

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[constructor](../../llms_base/classes/LLM.md#constructor)

#### Defined in

[langchain/src/llms/hf.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L43)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[CallOptions](../../llms_base/classes/LLM.md#calloptions)

#### Defined in

[langchain/src/llms/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L40)

### apiKey

> **apiKey**: `undefined` \| `string` = `undefined`

API key to use.

#### Implementation of

[HFInput](../interfaces/HFInput.md).[apiKey](../interfaces/HFInput.md#apikey)

#### Defined in

[langchain/src/llms/hf.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L41)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[caller](../../llms_base/classes/LLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### frequencyPenalty

> **frequencyPenalty**: `undefined` \| `number` = `undefined`

Penalizes repeated tokens according to frequency

#### Implementation of

[HFInput](../interfaces/HFInput.md).[frequencyPenalty](../interfaces/HFInput.md#frequencypenalty)

#### Defined in

[langchain/src/llms/hf.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L39)

### maxTokens

> **maxTokens**: `undefined` \| `number` = `undefined`

Maximum number of tokens to generate in the completion.

#### Implementation of

[HFInput](../interfaces/HFInput.md).[maxTokens](../interfaces/HFInput.md#maxtokens)

#### Defined in

[langchain/src/llms/hf.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L33)

### model

> **model**: `string` = `"gpt2"`

Model to use

#### Implementation of

[HFInput](../interfaces/HFInput.md).[model](../interfaces/HFInput.md#model)

#### Defined in

[langchain/src/llms/hf.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L29)

### temperature

> **temperature**: `undefined` \| `number` = `undefined`

Sampling temperature to use

#### Implementation of

[HFInput](../interfaces/HFInput.md).[temperature](../interfaces/HFInput.md#temperature)

#### Defined in

[langchain/src/llms/hf.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L31)

### topK

> **topK**: `undefined` \| `number` = `undefined`

Integer to define the top tokens considered within the sample operation to create new text.

#### Implementation of

[HFInput](../interfaces/HFInput.md).[topK](../interfaces/HFInput.md#topk)

#### Defined in

[langchain/src/llms/hf.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L37)

### topP

> **topP**: `undefined` \| `number` = `undefined`

Total probability mass of tokens to consider at each step

#### Implementation of

[HFInput](../interfaces/HFInput.md).[topP](../interfaces/HFInput.md#topp)

#### Defined in

[langchain/src/llms/hf.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L35)

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

[langchain/src/llms/hf.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/hf.ts#L65)

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
