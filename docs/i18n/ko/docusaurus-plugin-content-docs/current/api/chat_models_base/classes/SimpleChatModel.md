---
title: "SimpleChatModel"
---

# SimpleChatModel

Base class for language models.

## Hierarchy

- [`BaseChatModel`](BaseChatModel.md).**SimpleChatModel**

## Constructors

### constructor()

> **new SimpleChatModel**(`fields`: [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md)): [`SimpleChatModel`](SimpleChatModel.md)

#### Parameters

| Parameter | Type                                                                                   |
| :-------- | :------------------------------------------------------------------------------------- |
| `fields`  | [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) |

#### Returns

[`SimpleChatModel`](SimpleChatModel.md)

#### Inherited from

[BaseChatModel](BaseChatModel.md).[constructor](BaseChatModel.md#constructor)

#### Defined in

[langchain/src/chat_models/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L42)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Inherited from

[BaseChatModel](BaseChatModel.md).[CallOptions](BaseChatModel.md#calloptions)

#### Defined in

[langchain/src/chat_models/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L40)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseChatModel](BaseChatModel.md).[caller](BaseChatModel.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChatModel](BaseChatModel.md).[verbose](BaseChatModel.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChatModel](BaseChatModel.md).[callbacks](BaseChatModel.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_call()

> `Abstract` **\_call**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<`string`\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `messages`    | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                                                 |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/chat_models/base.ts:140](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L140)

### \_generate()

> **\_generate**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `stop`?: `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`ChatResult`](../../schema/interfaces/ChatResult.md)\>

#### Parameters

| Parameter     | Type                                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------------- |
| `messages`    | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                                                 |
| `stop?`       | `string`[] \| [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md) |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)                              |

#### Returns

`Promise`<[`ChatResult`](../../schema/interfaces/ChatResult.md)\>

#### Overrides

[BaseChatModel](BaseChatModel.md).[\_generate](BaseChatModel.md#_generate)

#### Defined in

[langchain/src/chat_models/base.ts:146](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L146)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `Record`<`string`, `any`\>

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[BaseChatModel](BaseChatModel.md).[\_identifyingParams](BaseChatModel.md#_identifyingparams)

#### Defined in

[langchain/src/base_language/index.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L129)

### \_llmType()

> `Abstract` **\_llmType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseChatModel](BaseChatModel.md).[\_llmType](BaseChatModel.md#_llmtype)

#### Defined in

[langchain/src/chat_models/base.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L100)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseChatModel](BaseChatModel.md).[\_modelType](BaseChatModel.md#_modeltype)

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

#### Inherited from

[BaseChatModel](BaseChatModel.md).[call](BaseChatModel.md#call)

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

#### Inherited from

[BaseChatModel](BaseChatModel.md).[callPrompt](BaseChatModel.md#callprompt)

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

#### Inherited from

[BaseChatModel](BaseChatModel.md).[generate](BaseChatModel.md#generate)

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

#### Inherited from

[BaseChatModel](BaseChatModel.md).[generatePrompt](BaseChatModel.md#generateprompt)

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

[BaseChatModel](BaseChatModel.md).[getNumTokens](BaseChatModel.md#getnumtokens)

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Inherited from

[BaseChatModel](BaseChatModel.md).[serialize](BaseChatModel.md#serialize)

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

#### Inherited from

[BaseChatModel](BaseChatModel.md).[\_combineLLMOutput](BaseChatModel.md#_combinellmoutput)

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

[BaseChatModel](BaseChatModel.md).[deserialize](BaseChatModel.md#deserialize)

#### Defined in

[langchain/src/base_language/index.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L147)
