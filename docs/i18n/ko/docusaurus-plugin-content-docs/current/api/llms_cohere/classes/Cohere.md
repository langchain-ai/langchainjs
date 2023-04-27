---
title: "Cohere"
---

# Cohere

Base interface for language model parameters.
A subclass of [BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md) should have a constructor that
takes in a parameter that extends this interface.

## Hierarchy

- [`LLM`](../../llms_base/classes/LLM.md).**Cohere**

## Implements

- [`CohereInput`](../interfaces/CohereInput.md)

## Constructors

### constructor()

> **new Cohere**(`fields`?: [`CohereInput`](../interfaces/CohereInput.md)): [`Cohere`](Cohere.md)

#### Parameters

| Parameter | Type                                          |
| :-------- | :-------------------------------------------- |
| `fields?` | [`CohereInput`](../interfaces/CohereInput.md) |

#### Returns

[`Cohere`](Cohere.md)

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[constructor](../../llms_base/classes/LLM.md#constructor)

#### Defined in

[langchain/src/llms/cohere.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L27)

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

[CohereInput](../interfaces/CohereInput.md).[apiKey](../interfaces/CohereInput.md#apikey)

#### Defined in

[langchain/src/llms/cohere.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L25)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[caller](../../llms_base/classes/LLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### maxTokens

> **maxTokens**: `number` = `250`

Maximum number of tokens to generate in the completion.

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[maxTokens](../interfaces/CohereInput.md#maxtokens)

#### Defined in

[langchain/src/llms/cohere.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L21)

### model

> **model**: `string`

Model to use

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[model](../interfaces/CohereInput.md#model)

#### Defined in

[langchain/src/llms/cohere.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L23)

### temperature

> **temperature**: `number` = `0`

Sampling temperature to use

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[temperature](../interfaces/CohereInput.md#temperature)

#### Defined in

[langchain/src/llms/cohere.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L19)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[verbose](../interfaces/CohereInput.md#verbose)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[verbose](../../llms_base/classes/LLM.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[cache](../interfaces/CohereInput.md#cache)

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[cache](../../llms_base/classes/LLM.md#cache)

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[CohereInput](../interfaces/CohereInput.md).[callbacks](../interfaces/CohereInput.md#callbacks)

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

[langchain/src/llms/cohere.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L48)

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
