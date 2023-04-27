---
title: "OpenAIChat"
---

# OpenAIChat

Wrapper around OpenAI large language models that use the Chat endpoint.

To use you should have the `openai` package installed, with the
`OPENAI_API_KEY` environment variable set.

## Remarks

Any parameters that are valid to be passed to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/chat/create) can be passed through [modelKwargs](OpenAIChat.md#modelkwargs), even
if not explicitly available on this class.

## Hierarchy

- [`LLM`](../../llms_base/classes/LLM.md).**OpenAIChat**

## Implements

- [`OpenAIChatInput`](../interfaces/OpenAIChatInput.md)

## Constructors

### constructor()

> **new OpenAIChat**(`fields`?: `Partial`<[`OpenAIChatInput`](../interfaces/OpenAIChatInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;}, `configuration`?: `ConfigurationParameters`): [`OpenAIChat`](OpenAIChat.md)

#### Parameters

| Parameter        | Type                                                                                                                                                                |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fields?`        | `Partial`<[`OpenAIChatInput`](../interfaces/OpenAIChatInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;} |
| `configuration?` | `ConfigurationParameters`                                                                                                                                           |

#### Returns

[`OpenAIChat`](OpenAIChat.md)

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[constructor](../../llms_base/classes/LLM.md#constructor)

#### Defined in

[langchain/src/llms/openai-chat.ts:128](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L128)

## Properties

### CallOptions

> **CallOptions**: [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md)

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[CallOptions](../../llms_base/classes/LLM.md#calloptions)

#### Defined in

[langchain/src/llms/openai-chat.ts:96](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L96)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[caller](../../llms_base/classes/LLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### frequencyPenalty

> **frequencyPenalty**: `number` = `0`

Penalizes repeated tokens according to frequency

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[frequencyPenalty](../interfaces/OpenAIChatInput.md#frequencypenalty)

#### Defined in

[langchain/src/llms/openai-chat.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L102)

### modelName

> **modelName**: `string` = `"gpt-3.5-turbo"`

Model name to use

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[modelName](../interfaces/OpenAIChatInput.md#modelname)

#### Defined in

[langchain/src/llms/openai-chat.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L112)

### n

> **n**: `number` = `1`

Number of chat completions to generate for each prompt

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[n](../interfaces/OpenAIChatInput.md#n)

#### Defined in

[langchain/src/llms/openai-chat.ts:106](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L106)

### presencePenalty

> **presencePenalty**: `number` = `0`

Penalizes repeated tokens

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[presencePenalty](../interfaces/OpenAIChatInput.md#presencepenalty)

#### Defined in

[langchain/src/llms/openai-chat.ts:104](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L104)

### streaming

> **streaming**: `boolean` = `false`

Whether to stream the results or not

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[streaming](../interfaces/OpenAIChatInput.md#streaming)

#### Defined in

[langchain/src/llms/openai-chat.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L122)

### temperature

> **temperature**: `number` = `1`

Sampling temperature to use, between 0 and 2, defaults to 1

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[temperature](../interfaces/OpenAIChatInput.md#temperature)

#### Defined in

[langchain/src/llms/openai-chat.ts:98](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L98)

### topP

> **topP**: `number` = `1`

Total probability mass of tokens to consider at each step, between 0 and 1, defaults to 1

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[topP](../interfaces/OpenAIChatInput.md#topp)

#### Defined in

[langchain/src/llms/openai-chat.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L100)

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

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[logitBias](../interfaces/OpenAIChatInput.md#logitbias)

#### Defined in

[langchain/src/llms/openai-chat.ts:108](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L108)

### maxTokens?

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion. If not specified,
defaults to the maximum number of tokens allowed by the model.

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[maxTokens](../interfaces/OpenAIChatInput.md#maxtokens)

#### Defined in

[langchain/src/llms/openai-chat.ts:110](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L110)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.create`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[modelKwargs](../interfaces/OpenAIChatInput.md#modelkwargs)

#### Defined in

[langchain/src/llms/openai-chat.ts:116](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L116)

### prefixMessages?

> **prefixMessages**: `ChatCompletionRequestMessage`[]

ChatGPT messages to pass as a prefix to the prompt

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[prefixMessages](../interfaces/OpenAIChatInput.md#prefixmessages)

#### Defined in

[langchain/src/llms/openai-chat.ts:114](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L114)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[stop](../interfaces/OpenAIChatInput.md#stop)

#### Defined in

[langchain/src/llms/openai-chat.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L120)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Implementation of

[OpenAIChatInput](../interfaces/OpenAIChatInput.md).[timeout](../interfaces/OpenAIChatInput.md#timeout)

#### Defined in

[langchain/src/llms/openai-chat.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L118)

## Methods

### \_generate()

Run the LLM on the given prompts and input.

> **\_generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter     | Type                                                                              |
| :------------ | :-------------------------------------------------------------------------------- |
| `prompts`     | `string`[]                                                                        |
| `stop?`       | `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md)   |
| `runManager?` | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md) |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[\_generate](../../llms_base/classes/LLM.md#_generate)

#### Defined in

[langchain/src/llms/base.ts:236](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L236)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[LLM](../../llms_base/classes/LLM.md).[\_llmType](../../llms_base/classes/LLM.md#_llmtype)

#### Defined in

[langchain/src/llms/openai-chat.ts:352](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L352)

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

> **call**(`prompt`: `string`, `stop`?: `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| `prompt`     | `string`                                                                        |
| `stop?`      | `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

#### Returns

`Promise`<`string`\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[call](../../llms_base/classes/LLM.md#call)

#### Defined in

[langchain/src/llms/base.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L164)

### generate()

Run the LLM on the given propmts an input, handling caching.

> **generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter    | Type                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| `prompts`    | `string`[]                                                                      |
| `stop?`      | `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[LLM](../../llms_base/classes/LLM.md).[generate](../../llms_base/classes/LLM.md#generate)

#### Defined in

[langchain/src/llms/base.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L112)

### generatePrompt()

> **generatePrompt**(`promptValues`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[], `stop`?: `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter      | Type                                                                            |
| :------------- | :------------------------------------------------------------------------------ |
| `promptValues` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[]                  |
| `stop?`        | `string`[] \| [`OpenAIChatCallOptions`](../interfaces/OpenAIChatCallOptions.md) |
| `callbacks?`   | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

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

### identifyingParams()

Get the identifying parameters for the model

> **identifyingParams**(): `object`

#### Returns

`object`

| Member       | Type     |
| :----------- | :------- |
| `model_name` | `string` |

#### Defined in

[langchain/src/llms/openai-chat.ts:202](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L202)

### invocationParams()

Get the parameters used to invoke the model

> **invocationParams**(): `Omit`<`CreateChatCompletionRequest`, "messages"\> & `Kwargs`

#### Returns

`Omit`<`CreateChatCompletionRequest`, "messages"\> & `Kwargs`

#### Defined in

[langchain/src/llms/openai-chat.ts:174](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L174)

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
