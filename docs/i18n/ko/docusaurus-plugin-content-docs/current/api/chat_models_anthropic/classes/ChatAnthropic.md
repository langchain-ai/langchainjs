---
title: "ChatAnthropic"
---

# ChatAnthropic

Wrapper around Anthropic large language models.

To use you should have the `@anthropic-ai/sdk` package installed, with the
`ANTHROPIC_API_KEY` environment variable set.

## Remarks

Any parameters that are valid to be passed to [`anthropic.complete`](https://console.anthropic.com/docs/api/reference) can be passed through [invocationKwargs](ChatAnthropic.md#invocationkwargs),
even if not explicitly available on this class.

## Hierarchy

- [`BaseChatModel`](../../chat_models_base/classes/BaseChatModel.md).**ChatAnthropic**

## Implements

- [`AnthropicInput`](../interfaces/AnthropicInput.md)

## Constructors

### constructor()

> **new ChatAnthropic**(`fields`?: `Partial`<[`AnthropicInput`](../interfaces/AnthropicInput.md)\> & [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) & \{`anthropicApiKey`?: `string`;}): [`ChatAnthropic`](ChatAnthropic.md)

#### Parameters

| Parameter | Type                                                                                                                                                                                         |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields?` | `Partial`<[`AnthropicInput`](../interfaces/AnthropicInput.md)\> & [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) & \{`anthropicApiKey`?: `string`;} |

#### Returns

[`ChatAnthropic`](ChatAnthropic.md)

#### Overrides

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[constructor](../../chat_models_base/classes/BaseChatModel.md#constructor)

#### Defined in

[langchain/src/chat_models/anthropic.ts:126](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L126)

## Properties

### CallOptions

> **CallOptions**: [`BaseLanguageModelCallOptions`](../../base_language/interfaces/BaseLanguageModelCallOptions.md)

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[CallOptions](../../chat_models_base/classes/BaseChatModel.md#calloptions)

#### Defined in

[langchain/src/chat_models/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L40)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[caller](../../chat_models_base/classes/BaseChatModel.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### maxTokensToSample

> **maxTokensToSample**: `number` = `2048`

A maximum number of tokens to generate before stopping.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[maxTokensToSample](../interfaces/AnthropicInput.md#maxtokenstosample)

#### Defined in

[langchain/src/chat_models/anthropic.ts:110](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L110)

### modelName

> **modelName**: `string` = `"claude-v1"`

Model name to use

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[modelName](../interfaces/AnthropicInput.md#modelname)

#### Defined in

[langchain/src/chat_models/anthropic.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L112)

### streaming

> **streaming**: `boolean` = `false`

Whether to stream the results or not

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[streaming](../interfaces/AnthropicInput.md#streaming)

#### Defined in

[langchain/src/chat_models/anthropic.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L118)

### temperature

> **temperature**: `number` = `1`

Amount of randomness injected into the response. Ranges
from 0 to 1. Use temp closer to 0 for analytical /
multiple choice, and temp closer to 1 for creative
and generative tasks.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[temperature](../interfaces/AnthropicInput.md#temperature)

#### Defined in

[langchain/src/chat_models/anthropic.ts:104](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L104)

### topK

> **topK**: `number` = `-1`

Only sample from the top K options for each subsequent
token. Used to remove "long tail" low probability
responses. Defaults to -1, which disables it.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[topK](../interfaces/AnthropicInput.md#topk)

#### Defined in

[langchain/src/chat_models/anthropic.ts:106](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L106)

### topP

> **topP**: `number` = `-1`

Does nucleus sampling, in which we compute the
cumulative distribution over all the options for each
subsequent token in decreasing probability order and
cut it off once it reaches a particular probability
specified by top_p. Defaults to -1, which disables it.
Note that you should either alter temperature or top_p,
but not both.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[topP](../interfaces/AnthropicInput.md#topp)

#### Defined in

[langchain/src/chat_models/anthropic.ts:108](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L108)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[verbose](../../chat_models_base/classes/BaseChatModel.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### apiKey?

> **apiKey**: `string`

Anthropic API key

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[apiKey](../interfaces/AnthropicInput.md#apikey)

#### Defined in

[langchain/src/chat_models/anthropic.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L102)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[callbacks](../../chat_models_base/classes/BaseChatModel.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### invocationKwargs?

> **invocationKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`anthropic.complete`](https://console.anthropic.com/docs/api/reference) that are not explicitly specified on this class.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[invocationKwargs](../interfaces/AnthropicInput.md#invocationkwargs)

#### Defined in

[langchain/src/chat_models/anthropic.ts:114](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L114)

### stopSequences?

> **stopSequences**: `string`[]

A list of strings upon which to stop generating.
You probably want `["\n\nHuman:"]`, as that's the cue for
the next turn in the dialog agent.

#### Implementation of

[AnthropicInput](../interfaces/AnthropicInput.md).[stopSequences](../interfaces/AnthropicInput.md#stopsequences)

#### Defined in

[langchain/src/chat_models/anthropic.ts:116](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L116)

## Methods

### \_llmType()

> **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[\_llmType](../../chat_models_base/classes/BaseChatModel.md#_llmtype)

#### Defined in

[langchain/src/chat_models/anthropic.ts:280](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L280)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[\_modelType](../../chat_models_base/classes/BaseChatModel.md#_modeltype)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[call](../../chat_models_base/classes/BaseChatModel.md#call)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[callPrompt](../../chat_models_base/classes/BaseChatModel.md#callprompt)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[generate](../../chat_models_base/classes/BaseChatModel.md#generate)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[generatePrompt](../../chat_models_base/classes/BaseChatModel.md#generateprompt)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[getNumTokens](../../chat_models_base/classes/BaseChatModel.md#getnumtokens)

#### Defined in

[langchain/src/base_language/index.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L90)

### identifyingParams()

Get the identifying parameters for the model

> **identifyingParams**(): `object`

#### Returns

`object`

| Member       | Type     |
| :----------- | :------- |
| `model_name` | `string` |

#### Defined in

[langchain/src/chat_models/anthropic.ts:184](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L184)

### invocationParams()

Get the parameters used to invoke the model

> **invocationParams**(): `Omit`<`SamplingParameters`, "prompt"\> & `Kwargs`

#### Returns

`Omit`<`SamplingParameters`, "prompt"\> & `Kwargs`

#### Defined in

[langchain/src/chat_models/anthropic.ts:160](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L160)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../base_language/types/SerializedLLM.md)

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[serialize](../../chat_models_base/classes/BaseChatModel.md#serialize)

#### Defined in

[langchain/src/base_language/index.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L136)

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

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[deserialize](../../chat_models_base/classes/BaseChatModel.md#deserialize)

#### Defined in

[langchain/src/base_language/index.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L147)
