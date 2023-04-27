---
title: "OpenAI"
---

# OpenAI

Wrapper around OpenAI large language models.

To use you should have the `openai` package installed, with the
`OPENAI_API_KEY` environment variable set.

## Remarks

Any parameters that are valid to be passed to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) can be passed through [modelKwargs](OpenAI.md#modelkwargs), even
if not explicitly available on this class.

## Hierarchy

- [`BaseLLM`](../../llms_base/classes/BaseLLM.md).**OpenAI**

## Implements

- [`OpenAIInput`](../interfaces/OpenAIInput.md)

## Constructors

### constructor()

> **new OpenAI**(`fields`?: `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;}, `configuration`?: `ConfigurationParameters`): [`OpenAI`](OpenAI.md)

#### Parameters

| Parameter        | Type                                                                                                                                                        |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields?`        | `Partial`<[`OpenAIInput`](../interfaces/OpenAIInput.md)\> & [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md) & \{`openAIApiKey`?: `string`;} |
| `configuration?` | `ConfigurationParameters`                                                                                                                                   |

#### Returns

[`OpenAI`](OpenAI.md)

#### Overrides

[BaseLLM](../../llms_base/classes/BaseLLM.md).[constructor](../../llms_base/classes/BaseLLM.md#constructor)

#### Defined in

[langchain/src/llms/openai.ts:143](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L143)

## Properties

### CallOptions

> **CallOptions**: [`OpenAICallOptions`](../interfaces/OpenAICallOptions.md)

#### Overrides

[BaseLLM](../../llms_base/classes/BaseLLM.md).[CallOptions](../../llms_base/classes/BaseLLM.md#calloptions)

#### Defined in

[langchain/src/llms/openai.ts:109](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L109)

### batchSize

> **batchSize**: `number` = `20`

Batch size to use when passing multiple documents to generate

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[batchSize](../interfaces/OpenAIInput.md#batchsize)

#### Defined in

[langchain/src/llms/openai.ts:131](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L131)

### bestOf

> **bestOf**: `number` = `1`

Generates `bestOf` completions server side and returns the "best"

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[bestOf](../interfaces/OpenAIInput.md#bestof)

#### Defined in

[langchain/src/llms/openai.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L123)

### caller

> **caller**: `AsyncCaller`

The async caller should be used by subclasses to make any async calls,
which will thus benefit from the concurrency and retry logic.

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[caller](../../llms_base/classes/BaseLLM.md#caller)

#### Defined in

[langchain/src/base_language/index.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L66)

### frequencyPenalty

> **frequencyPenalty**: `number` = `0`

Penalizes repeated tokens according to frequency

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[frequencyPenalty](../interfaces/OpenAIInput.md#frequencypenalty)

#### Defined in

[langchain/src/llms/openai.ts:117](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L117)

### maxTokens

> **maxTokens**: `number` = `256`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[maxTokens](../interfaces/OpenAIInput.md#maxtokens)

#### Defined in

[langchain/src/llms/openai.ts:113](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L113)

### modelName

> **modelName**: `string` = `"text-davinci-003"`

Model name to use

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[modelName](../interfaces/OpenAIInput.md#modelname)

#### Defined in

[langchain/src/llms/openai.ts:127](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L127)

### n

> **n**: `number` = `1`

Number of completions to generate for each prompt

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[n](../interfaces/OpenAIInput.md#n)

#### Defined in

[langchain/src/llms/openai.ts:121](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L121)

### presencePenalty

> **presencePenalty**: `number` = `0`

Penalizes repeated tokens

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[presencePenalty](../interfaces/OpenAIInput.md#presencepenalty)

#### Defined in

[langchain/src/llms/openai.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L119)

### streaming

> **streaming**: `boolean` = `false`

Whether to stream the results or not. Enabling disables tokenUsage reporting

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[streaming](../interfaces/OpenAIInput.md#streaming)

#### Defined in

[langchain/src/llms/openai.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L137)

### temperature

> **temperature**: `number` = `0.7`

Sampling temperature to use

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[temperature](../interfaces/OpenAIInput.md#temperature)

#### Defined in

[langchain/src/llms/openai.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L111)

### topP

> **topP**: `number` = `1`

Total probability mass of tokens to consider at each step

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[topP](../interfaces/OpenAIInput.md#topp)

#### Defined in

[langchain/src/llms/openai.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L115)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[verbose](../../llms_base/classes/BaseLLM.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### cache?

> **cache**: [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[cache](../../llms_base/classes/BaseLLM.md#cache)

#### Defined in

[langchain/src/llms/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L42)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[callbacks](../../llms_base/classes/BaseLLM.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[logitBias](../interfaces/OpenAIInput.md#logitbias)

#### Defined in

[langchain/src/llms/openai.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L125)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[modelKwargs](../interfaces/OpenAIInput.md#modelkwargs)

#### Defined in

[langchain/src/llms/openai.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L129)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[stop](../interfaces/OpenAIInput.md#stop)

#### Defined in

[langchain/src/llms/openai.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L135)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Implementation of

[OpenAIInput](../interfaces/OpenAIInput.md).[timeout](../interfaces/OpenAIInput.md#timeout)

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

#### Overrides

[BaseLLM](../../llms_base/classes/BaseLLM.md).[\_generate](../../llms_base/classes/BaseLLM.md#_generate)

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

#### Overrides

[BaseLLM](../../llms_base/classes/BaseLLM.md).[\_identifyingParams](../../llms_base/classes/BaseLLM.md#_identifyingparams)

#### Defined in

[langchain/src/llms/openai.ts:220](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L220)

### \_llmType()

Return the string type key uniquely identifying this class of LLM.

> **\_llmType**(): `string`

#### Returns

`string`

#### Overrides

[BaseLLM](../../llms_base/classes/BaseLLM.md).[\_llmType](../../llms_base/classes/BaseLLM.md#_llmtype)

#### Defined in

[langchain/src/llms/openai.ts:407](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L407)

### \_modelType()

> **\_modelType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[\_modelType](../../llms_base/classes/BaseLLM.md#_modeltype)

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

[BaseLLM](../../llms_base/classes/BaseLLM.md).[call](../../llms_base/classes/BaseLLM.md#call)

#### Defined in

[langchain/src/llms/base.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L164)

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

[BaseLLM](../../llms_base/classes/BaseLLM.md).[generate](../../llms_base/classes/BaseLLM.md#generate)

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

[BaseLLM](../../llms_base/classes/BaseLLM.md).[generatePrompt](../../llms_base/classes/BaseLLM.md#generateprompt)

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

[BaseLLM](../../llms_base/classes/BaseLLM.md).[getNumTokens](../../llms_base/classes/BaseLLM.md#getnumtokens)

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

[langchain/src/llms/openai.ts:231](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L231)

### invocationParams()

Get the parameters used to invoke the model

> **invocationParams**(): `CreateCompletionRequest` & `Kwargs`

#### Returns

`CreateCompletionRequest` & `Kwargs`

#### Defined in

[langchain/src/llms/openai.ts:203](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L203)

### serialize()

Return a json-like object representing this LLM.

> **serialize**(): [`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Returns

[`SerializedLLM`](../../llms_base/types/SerializedLLM.md)

#### Inherited from

[BaseLLM](../../llms_base/classes/BaseLLM.md).[serialize](../../llms_base/classes/BaseLLM.md#serialize)

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

[BaseLLM](../../llms_base/classes/BaseLLM.md).[deserialize](../../llms_base/classes/BaseLLM.md#deserialize)

#### Defined in

[langchain/src/llms/base.ts:204](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L204)
