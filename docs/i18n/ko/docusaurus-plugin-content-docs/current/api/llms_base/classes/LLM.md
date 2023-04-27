---
title: "LLM"
---

# LLM

LLM class that provides a simpler interface to subclass than [BaseLLM](BaseLLM.md).

Requires only implementing a simpler [\_call](LLM.md#_call) method instead of [\_generate](LLM.md#_generate).

## Hierarchy

- [`BaseLLM`](BaseLLM.md).**LLM**

## Constructors

### constructor()

> **new LLM**(«destructured»: [`BaseLLMParams`](../interfaces/BaseLLMParams.md)): [`LLM`](LLM.md)

#### Parameters

| Parameter        | Type                                              |
| :--------------- | :------------------------------------------------ |
| `«destructured»` | [`BaseLLMParams`](../interfaces/BaseLLMParams.md) |

#### Returns

[`LLM`](LLM.md)

#### Inherited from

[BaseLLM](BaseLLM.md).[constructor](BaseLLM.md#constructor)

#### Defined in

[langchain/src/llms/base.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L44)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Inherited from

[BaseLLM](BaseLLM.md).[CallOptions](BaseLLM.md#calloptions)

#### Defined in

[langchain/src/llms/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L40)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseLLM](BaseLLM.md).[caller](BaseLLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseLLM](BaseLLM.md).[verbose](BaseLLM.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Inherited from

[BaseLLM](BaseLLM.md).[cache](BaseLLM.md#cache)

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLLM](BaseLLM.md).[callbacks](BaseLLM.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_call()

Run the LLM on the given prompt and input.

> `Abstract` **\_call**(`prompt`: `string`, `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<`string`\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `prompt`      | `string`                                                                                                       |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/llms/base.ts:230](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L230)

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

#### Overrides

[BaseLLM](BaseLLM.md).[\_generate](BaseLLM.md#_generate)

#### Defined in

[langchain/src/llms/base.ts:236](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L236)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[BaseLLM](BaseLLM.md).[\_identifyingParams](BaseLLM.md#_identifyingparams)

#### Defined in

[langchain/src/llms/base.ts:177](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L177)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> `Abstract` **\_llmType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseLLM](BaseLLM.md).[\_llmType](BaseLLM.md#_llmtype)

#### Defined in

[langchain/src/llms/base.ts:184](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L184)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseLLM](BaseLLM.md).[\_modelType](BaseLLM.md#_modeltype)

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

#### Inherited from

[BaseLLM](BaseLLM.md).[call](BaseLLM.md#call)

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

[BaseLLM](BaseLLM.md).[generate](BaseLLM.md#generate)

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

[BaseLLM](BaseLLM.md).[generatePrompt](BaseLLM.md#generateprompt)

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

[BaseLLM](BaseLLM.md).[getNumTokens](BaseLLM.md#getnumtokens)

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../types/SerializedLLM.md)

#### Inherited from

[BaseLLM](BaseLLM.md).[serialize](BaseLLM.md#serialize)

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

#### Inherited from

[BaseLLM](BaseLLM.md).[deserialize](BaseLLM.md#deserialize)

#### Defined in

[langchain/src/llms/base.ts:204](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L204)
