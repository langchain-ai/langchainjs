---
title: "PromptLayerOpenAI"
---

# PromptLayerOpenAI

PromptLayer wrapper to OpenAI

## Hierarchy

- [`OpenAI`](OpenAI.md).**PromptLayerOpenAI**

## Constructors

### constructor()

> **new PromptLayerOpenAI**(`fields`?: `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;} & \{`plTags`?: `string`[];
> `promptLayerApiKey`?: `string`;}): [`PromptLayerOpenAI`](PromptLayerOpenAI.md)

#### Parameters

| Parameter | Type                                                                                                                                                                                                                         |
| :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields?` | `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;} & \{`plTags`?: `string`[];<br />`promptLayerApiKey`?: `string`;} |

#### Returns

[`PromptLayerOpenAI`](PromptLayerOpenAI.md)

#### Overrides

[OpenAI](OpenAI.md).[constructor](OpenAI.md#constructor)

#### Defined in

[langchain/src/llms/openai.ts:421](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L421)

## Properties

### CallOptions

> **CallOptions**: [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md)

#### Inherited from

[OpenAI](OpenAI.md).[CallOptions](OpenAI.md#calloptions)

#### Defined in

[langchain/src/llms/openai.ts:109](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L109)

### batchSize

> **batchSize**: `number` = `20`

Batch size to use when passing multiple documents to generate

#### Inherited from

[OpenAI](OpenAI.md).[batchSize](OpenAI.md#batchsize)

#### Defined in

[langchain/src/llms/openai.ts:131](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L131)

### bestOf

> **bestOf**: `number` = `1`

Generates `bestOf` completions server side and returns the "best"

#### Inherited from

[OpenAI](OpenAI.md).[bestOf](OpenAI.md#bestof)

#### Defined in

[langchain/src/llms/openai.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L123)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[OpenAI](OpenAI.md).[caller](OpenAI.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### frequencyPenalty

> **frequencyPenalty**: `number` = `0`

Penalizes repeated tokens according to frequency

#### Inherited from

[OpenAI](OpenAI.md).[frequencyPenalty](OpenAI.md#frequencypenalty)

#### Defined in

[langchain/src/llms/openai.ts:117](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L117)

### maxTokens

> **maxTokens**: `number` = `256`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Inherited from

[OpenAI](OpenAI.md).[maxTokens](OpenAI.md#maxtokens)

#### Defined in

[langchain/src/llms/openai.ts:113](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L113)

### modelName

> **modelName**: `string` = `"text-davinci-003"`

Model name to use

#### Inherited from

[OpenAI](OpenAI.md).[modelName](OpenAI.md#modelname)

#### Defined in

[langchain/src/llms/openai.ts:127](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L127)

### n

> **n**: `number` = `1`

Number of completions to generate for each prompt

#### Inherited from

[OpenAI](OpenAI.md).[n](OpenAI.md#n)

#### Defined in

[langchain/src/llms/openai.ts:121](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L121)

### presencePenalty

> **presencePenalty**: `number` = `0`

Penalizes repeated tokens

#### Inherited from

[OpenAI](OpenAI.md).[presencePenalty](OpenAI.md#presencepenalty)

#### Defined in

[langchain/src/llms/openai.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L119)

### streaming

> **streaming**: `boolean` = `false`

Whether to stream the results or not. Enabling disables tokenUsage reporting

#### Inherited from

[OpenAI](OpenAI.md).[streaming](OpenAI.md#streaming)

#### Defined in

[langchain/src/llms/openai.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L137)

### temperature

> **temperature**: `number` = `0.7`

Sampling temperature to use

#### Inherited from

[OpenAI](OpenAI.md).[temperature](OpenAI.md#temperature)

#### Defined in

[langchain/src/llms/openai.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L111)

### topP

> **topP**: `number` = `1`

Total probability mass of tokens to consider at each step

#### Inherited from

[OpenAI](OpenAI.md).[topP](OpenAI.md#topp)

#### Defined in

[langchain/src/llms/openai.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L115)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[OpenAI](OpenAI.md).[verbose](OpenAI.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Inherited from

[OpenAI](OpenAI.md).[cache](OpenAI.md#cache)

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[OpenAI](OpenAI.md).[callbacks](OpenAI.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Inherited from

[OpenAI](OpenAI.md).[logitBias](OpenAI.md#logitbias)

#### Defined in

[langchain/src/llms/openai.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L125)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Inherited from

[OpenAI](OpenAI.md).[modelKwargs](OpenAI.md#modelkwargs)

#### Defined in

[langchain/src/llms/openai.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L129)

### plTags?

> **plTags**: `string`[]

#### Defined in

[langchain/src/llms/openai.ts:419](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L419)

### promptLayerApiKey?

> **promptLayerApiKey**: `string`

#### Defined in

[langchain/src/llms/openai.ts:417](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L417)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Inherited from

[OpenAI](OpenAI.md).[stop](OpenAI.md#stop)

#### Defined in

[langchain/src/llms/openai.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L135)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Inherited from

[OpenAI](OpenAI.md).[timeout](OpenAI.md#timeout)

#### Defined in

[langchain/src/llms/openai.ts:133](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L133)

## Methods

### \_generate()

Call out to OpenAI's endpoint with k unique prompts

#### Example

```ts
import { OpenAI } from "langchain/llms/openai";
const openai = new OpenAI();
const response = await openai.generate(["Tell me a joke."]);
```

> **\_generate**(`prompts`: `string`[], `stopOrOptions`?: `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md), `runManager`?: [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter        | Type                                                                              | Description                                       |
| :--------------- | :-------------------------------------------------------------------------------- | :------------------------------------------------ |
| `prompts`        | `string`[]                                                                        | The prompts to pass into the model.               |
| `stopOrOptions?` | `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md)           | -                                                 |
| `runManager?`    | [`CallbackManagerForLLMRun`](../../callbacks/classes/CallbackManagerForLLMRun.md) | Optional callback manager to use when generating. |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

The full LLM output.

#### Inherited from

[OpenAI](OpenAI.md).[\_generate](OpenAI.md#_generate)

#### Defined in

[langchain/src/llms/openai.ts:251](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L251)

### \_identifyingParams()

Get the identifying parameters of the LLM.

> **\_identifyingParams**(): `object`

#### Returns

`object`

| Member       | Type     |
| :----------- | :------- |
| `model_name` | `string` |

#### Inherited from

[OpenAI](OpenAI.md).[\_identifyingParams](OpenAI.md#_identifyingparams)

#### Defined in

[langchain/src/llms/openai.ts:220](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L220)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> **\_llmType**(): `string`

#### Returns

`string`

#### Inherited from

[OpenAI](OpenAI.md).[\_llmType](OpenAI.md#_llmtype)

#### Defined in

[langchain/src/llms/openai.ts:407](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L407)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[OpenAI](OpenAI.md).[\_modelType](OpenAI.md#_modeltype)

#### Defined in

[langchain/src/llms/base.ts:197](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L197)

### call()

Convenience wrapper for [generate](../../llms_base/classes/BaseLLM.md#generate) that takes in a single string prompt and returns a single string output.

> **call**(`prompt`: `string`, `stop`?: `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                                                    |
| :----------- | :---------------------------------------------------------------------- |
| `prompt`     | `string`                                                                |
| `stop?`      | `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                       |

#### Returns

`Promise`<`string`\>

#### Inherited from

[OpenAI](OpenAI.md).[call](OpenAI.md#call)

#### Defined in

[langchain/src/llms/base.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L164)

### completionWithRetry()

> **completionWithRetry**(`request`: `CreateCompletionRequest`, `options`?: `StreamingAxiosConfiguration`): `Promise`<`CreateCompletionResponse`\>

#### Parameters

| Parameter  | Type                          |
| :--------- | :---------------------------- |
| `request`  | `CreateCompletionRequest`     |
| `options?` | `StreamingAxiosConfiguration` |

#### Returns

`Promise`<`CreateCompletionResponse`\>

#### Overrides

OpenAI.completionWithRetry

#### Defined in

[langchain/src/llms/openai.ts:442](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L442)

### generate()

Run the LLM on the given propmts an input, handling caching.

> **generate**(`prompts`: `string`[], `stop`?: `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter    | Type                                                                    |
| :----------- | :---------------------------------------------------------------------- |
| `prompts`    | `string`[]                                                              |
| `stop?`      | `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                       |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[OpenAI](OpenAI.md).[generate](OpenAI.md#generate)

#### Defined in

[langchain/src/llms/base.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L112)

### generatePrompt()

> **generatePrompt**(`promptValues`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[], `stop`?: `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Parameters

| Parameter      | Type                                                                    |
| :------------- | :---------------------------------------------------------------------- |
| `promptValues` | [`BasePromptValue`](../../schema/classes/BasePromptValue.md)[]          |
| `stop?`        | `string`[] \| [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md) |
| `callbacks?`   | [`Callbacks`](../../callbacks/types/Callbacks.md)                       |

#### Returns

`Promise`<[`LLMResult`](../../schema/types/LLMResult.md)\>

#### Inherited from

[OpenAI](OpenAI.md).[generatePrompt](OpenAI.md#generateprompt)

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

[OpenAI](OpenAI.md).[getNumTokens](OpenAI.md#getnumtokens)

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

#### Inherited from

[OpenAI](OpenAI.md).[identifyingParams](OpenAI.md#identifyingparams)

#### Defined in

[langchain/src/llms/openai.ts:231](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L231)

### invocationParams()

Get the parameters used to invoke the model

> **invocationParams**(): `CreateCompletionRequest` & `Kwargs`

#### Returns

`CreateCompletionRequest` & `Kwargs`

#### Inherited from

[OpenAI](OpenAI.md).[invocationParams](OpenAI.md#invocationparams)

#### Defined in

[langchain/src/llms/openai.ts:203](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L203)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Inherited from

[OpenAI](OpenAI.md).[serialize](OpenAI.md#serialize)

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

[OpenAI](OpenAI.md).[deserialize](OpenAI.md#deserialize)

#### Defined in

[langchain/src/llms/base.ts:204](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L204)
