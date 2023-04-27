---
title: "ChatOpenAI"
---

# ChatOpenAI

Wrapper around OpenAI large language models that use the Chat endpoint.

To use you should have the `openai` package installed, with the
`OPENAI_API_KEY` environment variable set.

## Remarks

Any parameters that are valid to be passed to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/chat/create) can be passed through [modelKwargs](ChatOpenAI.md#modelkwargs), even
if not explicitly available on this class.

## Hierarchy

- [`BaseChatModel`](../../chat_models_base/classes/BaseChatModel.md).**ChatOpenAI**

## Implements

- [`OpenAIInput`](../interfaces/OpenAIInput.md)

## Constructors

### constructor()

> **new ChatOpenAI**(`fields`?: `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) & \{`cache`?: `boolean`;
> `concurrency`?: `number`;
> `openAIApiKey`?: `string`;}, `configuration`?: `ConfigurationParameters`): [`ChatOpenAI`](ChatOpenAI.md)

#### Parameters

| Parameter        | Type                                                                                                                                                                                                                                         |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields?`        | `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md) & \{`cache`?: `boolean`;<br />`concurrency`?: `number`;<br />`openAIApiKey`?: `string`;} |
| `configuration?` | `ConfigurationParameters`                                                                                                                                                                                                                    |

#### Returns

[`ChatOpenAI`](ChatOpenAI.md)

#### Overrides

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[constructor](../../chat_models_base/classes/BaseChatModel.md#constructor)

#### Defined in

[langchain/src/chat_models/openai.ts:176](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L176)

## Properties

### CallOptions

> **CallOptions**: [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md)

#### Overrides

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[CallOptions](../../chat_models_base/classes/BaseChatModel.md#calloptions)

#### Defined in

[langchain/src/chat_models/openai.ts:146](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L146)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[caller](../../chat_models_base/classes/BaseChatModel.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### frequencyPenalty

> **frequencyPenalty**: `number` = `0`

Penalizes repeated tokens according to frequency

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[frequencyPenalty](../interfaces/OpenAIInput.md#frequencypenalty)

#### Defined in

[langchain/src/chat_models/openai.ts:152](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L152)

### modelName

> **modelName**: `string` = `"gpt-3.5-turbo"`

Model name to use

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[modelName](../interfaces/OpenAIInput.md#modelname)

#### Defined in

[langchain/src/chat_models/openai.ts:160](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L160)

### n

> **n**: `number` = `1`

Number of chat completions to generate for each prompt

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[n](../interfaces/OpenAIInput.md#n)

#### Defined in

[langchain/src/chat_models/openai.ts:156](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L156)

### presencePenalty

> **presencePenalty**: `number` = `0`

Penalizes repeated tokens

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[presencePenalty](../interfaces/OpenAIInput.md#presencepenalty)

#### Defined in

[langchain/src/chat_models/openai.ts:154](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L154)

### streaming

> **streaming**: `boolean` = `false`

Whether to stream the results or not. Enabling disables tokenUsage reporting

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[streaming](../interfaces/OpenAIInput.md#streaming)

#### Defined in

[langchain/src/chat_models/openai.ts:168](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L168)

### temperature

> **temperature**: `number` = `1`

Sampling temperature to use, between 0 and 2, defaults to 1

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[temperature](../interfaces/OpenAIInput.md#temperature)

#### Defined in

[langchain/src/chat_models/openai.ts:148](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L148)

### topP

> **topP**: `number` = `1`

Total probability mass of tokens to consider at each step, between 0 and 1, defaults to 1

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[topP](../interfaces/OpenAIInput.md#topp)

#### Defined in

[langchain/src/chat_models/openai.ts:150](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L150)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[verbose](../../chat_models_base/classes/BaseChatModel.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[callbacks](../../chat_models_base/classes/BaseChatModel.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[logitBias](../interfaces/OpenAIInput.md#logitbias)

#### Defined in

[langchain/src/chat_models/openai.ts:158](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L158)

### maxTokens?

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion. If not specified,
defaults to the maximum number of tokens allowed by the model.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[maxTokens](../interfaces/OpenAIInput.md#maxtokens)

#### Defined in

[langchain/src/chat_models/openai.ts:170](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L170)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.create`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[modelKwargs](../interfaces/OpenAIInput.md#modelkwargs)

#### Defined in

[langchain/src/chat_models/openai.ts:162](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L162)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[stop](../interfaces/OpenAIInput.md#stop)

#### Defined in

[langchain/src/chat_models/openai.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L164)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[timeout](../interfaces/OpenAIInput.md#timeout)

#### Defined in

[langchain/src/chat_models/openai.ts:166](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L166)

## Methods

### \_llmType()

> **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[\_llmType](../../chat_models_base/classes/BaseChatModel.md#_llmtype)

#### Defined in

[langchain/src/chat_models/openai.ts:460](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L460)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[\_modelType](../../chat_models_base/classes/BaseChatModel.md#_modeltype)

#### Defined in

[langchain/src/chat_models/base.ts:96](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L96)

### call()

> **call**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `stop`?: `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Parameters

| Parameter    | Type                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| `messages`   | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                  |
| `stop?`      | `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[call](../../chat_models_base/classes/BaseChatModel.md#call)

#### Defined in

[langchain/src/chat_models/base.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L119)

### callPrompt()

> **callPrompt**(`promptValue`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `stop`?: `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Parameters

| Parameter     | Type                                                                            |
| :------------ | :------------------------------------------------------------------------------ |
| `promptValue` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)                    |
| `stop?`       | `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md) |
| `callbacks?`  | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[callPrompt](../../chat_models_base/classes/BaseChatModel.md#callprompt)

#### Defined in

[langchain/src/chat_models/base.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L129)

### generate()

> **generate**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[][], `stop`?: `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter    | Type                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| `messages`   | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[][]                |
| `stop?`      | `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[BaseChatModel](../../chat_models_base/classes/BaseChatModel.md).[generate](../../chat_models_base/classes/BaseChatModel.md#generate)

#### Defined in

[langchain/src/chat_models/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/base.ts#L50)

### generatePrompt()

> **generatePrompt**(`promptValues`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[], `stop`?: `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter      | Type                                                                            |
| :------------- | :------------------------------------------------------------------------------ |
| `promptValues` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[]                  |
| `stop?`        | `string`[] \| [`ChatOpenAICallOptions`](../interfaces/ChatOpenAICallOptions.md) |
| `callbacks?`   | [`Callbacks`](../../callbacks/types/Callbacks.md)                               |

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

### getNumTokensFromMessages()

> **getNumTokensFromMessages**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]): `Promise`<\{`countPerMessage`: `number`[];
> `totalCount`: `number`;}\>

#### Parameters

| Parameter  | Type                                                           |
| :--------- | :------------------------------------------------------------- |
| `messages` | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[] |

#### Returns

`Promise`<\{`countPerMessage`: `number`[];
`totalCount`: `number`;}\>

#### Defined in

[langchain/src/chat_models/openai.ts:404](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L404)

### identifyingParams()

Get the identifying parameters for the model

> **identifyingParams**(): `object`

#### Returns

`object`

| Member       | Type     |
| :----------- | :------- |
| `model_name` | `string` |

#### Defined in

[langchain/src/chat_models/openai.ts:253](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L253)

### invocationParams()

Get the parameters used to invoke the model

> **invocationParams**(): `Omit`<`CreateChatCompletionRequest`, "messages"\> & `Kwargs`

#### Returns

`Omit`<`CreateChatCompletionRequest`, "messages"\> & `Kwargs`

#### Defined in

[langchain/src/chat_models/openai.ts:225](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L225)

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
