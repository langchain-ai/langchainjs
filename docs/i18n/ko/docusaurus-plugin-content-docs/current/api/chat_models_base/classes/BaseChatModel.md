---
title: "BaseChatModel"
---

# BaseChatModel

Base class for language models.

## Hierarchy

- [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md).**BaseChatModel**

## Constructors

### constructor()

> **new BaseChatModel**(`fields`: [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md)): [`BaseChatModel`](BaseChatModel.md)

#### Parameters

| Parameter | Type                                                                                   |
| :-------- | :------------------------------------------------------------------------------------- |
| `fields`  | [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) |

#### Returns

[`BaseChatModel`](BaseChatModel.md)

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[constructor](../../base_language/classes/BaseLanguageModel.md#constructor)

#### Defined in

[langchain/src/chat_models/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L42)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[CallOptions](../../base_language/classes/BaseLanguageModel.md#calloptions)

#### Defined in

[langchain/src/chat_models/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L40)

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

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[callbacks](../../base_language/classes/BaseLanguageModel.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_generate()

> `Abstract` **\_generate**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`ChatResult`](../../schema/interfaces/ChatResult.md)\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `messages`    | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                                                 |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<[`ChatResult`](../../schema/interfaces/ChatResult.md)\>

#### Defined in

[langchain/src/chat_models/base.ts:113](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L113)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_identifyingParams](../../base_language/classes/BaseLanguageModel.md#_identifyingparams)

#### Defined in

[langchain/src/base_language/index.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L129)

### \_llmType()

> `Abstract` **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_llmType](../../base_language/classes/BaseLanguageModel.md#_llmtype)

#### Defined in

[langchain/src/chat_models/base.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L100)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Overrides

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[\_modelType](../../base_language/classes/BaseLanguageModel.md#_modeltype)

#### Defined in

[langchain/src/chat_models/base.ts:96](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L96)

### call()

> **call**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Parameters

| Parameter    | Type                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| `messages`   | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                                                 |
| `stop?`      | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Defined in

[langchain/src/chat_models/base.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L119)

### callPrompt()

> **callPrompt**(`promptValue`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `promptValue` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)                                                   |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?`  | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Defined in

[langchain/src/chat_models/base.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L129)

### generate()

> **generate**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[][], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter    | Type                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------- |
| `messages`   | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[][]                                               |
| `stop?`      | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                                                              |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Defined in

[langchain/src/chat_models/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L50)

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

[langchain/src/chat_models/base.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L102)

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

> **serialize**(): [`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[serialize](../../base_language/classes/BaseLanguageModel.md#serialize)

#### Defined in

[langchain/src/base_language/index.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L136)

### \_combineLLMOutput()?

> `Optional` `Abstract` **\_combineLLMOutput**(...`llmOutputs`: (`undefined` \| `Record`<`string`, `any`\>)[]): `undefined` \| `Record`<`string`, `any`\>

#### Parameters

| Parameter       | Type                                           |
| :-------------- | :--------------------------------------------- |
| `...llmOutputs` | (`undefined` \| `Record`<`string`, `any`\>)[] |

#### Returns

`undefined` \| `Record`<`string`, `any`\>

#### Defined in

[langchain/src/chat_models/base.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L46)

### deserialize()

Load an LLM from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLM`](../../base_language/types/SerializedLLM.md)): `Promise`<[`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)\>

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `data`    | [`SerializedLLM`](../../base_language/types/SerializedLLM.md) |

#### Returns

`Promise`<[`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)\>

#### Inherited from

[BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md).[deserialize](../../base_language/classes/BaseLanguageModel.md#deserialize)

#### Defined in

[langchain/src/base_language/index.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L147)
