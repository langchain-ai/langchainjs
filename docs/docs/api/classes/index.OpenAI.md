---
id: "index.OpenAI"
title: "Class: OpenAI"
sidebar_label: "OpenAI"
custom_edit_url: null
---

[index](../modules/).OpenAI

Wrapper around OpenAI large language models.

To use you should have the `openai` package installed, with the
`OPENAI_API_KEY` environment variable set.

**`Remarks`**

Any parameters that are valid to be passed to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) can be passed through [modelKwargs](.OpenAI#modelkwargs), even
if not explicitly available on this class.

## Hierarchy

- [`BaseLLM`](llms.BaseLLM.md)

  ↳ **`OpenAI`**

## Implements

- [`OpenAIInput`](../interfaces/.internal.OpenAIInput)

## Constructors

### constructor

• **new OpenAI**(`fields?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields?` | `Partial`<[`OpenAIInput`](../interfaces/.internal.OpenAIInput)\> & { `callbackManager?`: [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager) ; `openAIApiKey?`: `string` ; `verbose?`: `boolean`  } |

#### Overrides

[BaseLLM](llms.BaseLLM.md).[constructor](llms.BaseLLM.md#constructor)

#### Defined in

[llms/openai.ts:128](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L128)

## Properties

### batchSize

• **batchSize**: `number` = `20`

Batch size to use when passing multiple documents to generate

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[batchSize](../interfaces/.internal.OpenAIInput#batchsize)

#### Defined in

[llms/openai.ts:120](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L120)

___

### bestOf

• **bestOf**: `number` = `1`

Generates `bestOf` completions server side and returns the "best"

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[bestOf](../interfaces/.internal.OpenAIInput#bestof)

#### Defined in

[llms/openai.ts:112](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L112)

___

### cache

• `Optional` **cache**: `boolean`

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[cache](llms.BaseLLM.md#cache)

#### Defined in

[llms/base.ts:34](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L34)

___

### callbackManager

• **callbackManager**: [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager)

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[callbackManager](llms.BaseLLM.md#callbackmanager)

#### Defined in

[llms/base.ts:36](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L36)

___

### client

• `Private` **client**: `OpenAIApi`

#### Defined in

[llms/openai.ts:126](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L126)

___

### frequencyPenalty

• **frequencyPenalty**: `number` = `0`

Penalizes repeated tokens according to frequency

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[frequencyPenalty](../interfaces/.internal.OpenAIInput#frequencypenalty)

#### Defined in

[llms/openai.ts:106](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L106)

___

### logitBias

• `Optional` **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[logitBias](../interfaces/.internal.OpenAIInput#logitbias)

#### Defined in

[llms/openai.ts:114](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L114)

___

### maxRetries

• **maxRetries**: `number` = `6`

Maximum number of retries to make when generating

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[maxRetries](../interfaces/.internal.OpenAIInput#maxretries)

#### Defined in

[llms/openai.ts:122](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L122)

___

### maxTokens

• **maxTokens**: `number` = `256`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[maxTokens](../interfaces/.internal.OpenAIInput#maxtokens)

#### Defined in

[llms/openai.ts:102](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L102)

___

### modelKwargs

• `Optional` **modelKwargs**: [`Kwargs`](../modules/.internal#kwargs)

Holds any additional parameters that are valid to pass to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[modelKwargs](../interfaces/.internal.OpenAIInput#modelkwargs)

#### Defined in

[llms/openai.ts:118](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L118)

___

### modelName

• **modelName**: `string` = `"text-davinci-003"`

Model name to use

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[modelName](../interfaces/.internal.OpenAIInput#modelname)

#### Defined in

[llms/openai.ts:116](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L116)

___

### n

• **n**: `number` = `1`

Number of completions to generate for each prompt

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[n](../interfaces/.internal.OpenAIInput#n)

#### Defined in

[llms/openai.ts:110](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L110)

___

### name

• **name**: `string`

The name of the LLM class

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[name](llms.BaseLLM.md#name)

#### Defined in

[llms/base.ts:32](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L32)

___

### presencePenalty

• **presencePenalty**: `number` = `0`

Penalizes repeated tokens

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[presencePenalty](../interfaces/.internal.OpenAIInput#presencepenalty)

#### Defined in

[llms/openai.ts:108](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L108)

___

### stop

• `Optional` **stop**: `string`[]

List of stop words to use when generating

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[stop](../interfaces/.internal.OpenAIInput#stop)

#### Defined in

[llms/openai.ts:124](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L124)

___

### temperature

• **temperature**: `number` = `0.7`

Sampling temperature to use

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[temperature](../interfaces/.internal.OpenAIInput#temperature)

#### Defined in

[llms/openai.ts:100](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L100)

___

### topP

• **topP**: `number` = `1`

Total probability mass of tokens to consider at each step

#### Implementation of

[OpenAIInput](../interfaces/.internal.OpenAIInput).[topP](../interfaces/.internal.OpenAIInput#topp)

#### Defined in

[llms/openai.ts:104](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L104)

___

### verbose

• `Optional` **verbose**: `boolean` = `false`

Whether to print out response text.

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[verbose](llms.BaseLLM.md#verbose)

#### Defined in

[llms/base.ts:41](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L41)

## Methods

### \_generate

▸ **_generate**(`prompts`, `stop?`): `Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

Call out to OpenAI's endpoint with k unique prompts

**`Example`**

```ts
import { OpenAI } from "langchain/llms";
const openai = new OpenAI();
const response = await openai.generate(["Tell me a joke."]);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `prompts` | `string`[] | The prompts to pass into the model. |
| `stop?` | `string`[] | Optional list of stop words to use when generating. |

#### Returns

`Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

The full LLM output.

#### Overrides

[BaseLLM](llms.BaseLLM.md).[_generate](llms.BaseLLM.md#_generate)

#### Defined in

[llms/openai.ts:207](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L207)

___

### \_identifyingParams

▸ **_identifyingParams**(): `Record`<`string`, `any`\>

Get the identifying parameters of the LLM.

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[_identifyingParams](llms.BaseLLM.md#_identifyingparams)

#### Defined in

[llms/base.ts:133](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L133)

___

### \_llmType

▸ **_llmType**(): `string`

Return the string type key uniquely identifying this class of LLM.

#### Returns

`string`

#### Overrides

[BaseLLM](llms.BaseLLM.md).[_llmType](llms.BaseLLM.md#_llmtype)

#### Defined in

[llms/openai.ts:271](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L271)

___

### call

▸ **call**(`prompt`, `stop?`): `Promise`<`string`\>

Convenience wrapper for [generate](.OpenAI#generate) that takes in a single string prompt and returns a single string output.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompt` | `string` |
| `stop?` | `string`[] |

#### Returns

`Promise`<`string`\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[call](llms.BaseLLM.md#call)

#### Defined in

[llms/base.ts:124](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L124)

___

### generate

▸ **generate**(`prompts`, `stop?`): `Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

Run the LLM on the given propmts an input, handling caching.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompts` | `string`[] |
| `stop?` | `string`[] |

#### Returns

`Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[generate](llms.BaseLLM.md#generate)

#### Defined in

[llms/base.ts:78](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L78)

___

### identifyingParams

▸ **identifyingParams**(): `Object`

Get the identifyin parameters for the model

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `model_name` | `string` |

#### Defined in

[llms/openai.ts:185](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L185)

___

### invocationParams

▸ **invocationParams**(): `CreateCompletionRequest` & [`Kwargs`](../modules/.internal#kwargs)

Get the parameters used to invoke the model

#### Returns

`CreateCompletionRequest` & [`Kwargs`](../modules/.internal#kwargs)

#### Defined in

[llms/openai.ts:166](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/openai.ts#L166)

___

### serialize

▸ **serialize**(): [`SerializedLLM`](../modules/llms.md#serializedllm)

Return a json-like object representing this LLM.

#### Returns

[`SerializedLLM`](../modules/llms.md#serializedllm)

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[serialize](llms.BaseLLM.md#serialize)

#### Defined in

[llms/base.ts:145](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L145)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`BaseLLM`](llms.BaseLLM.md)\>

Load an LLM from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedLLM`](../modules/llms.md#serializedllm) |

#### Returns

`Promise`<[`BaseLLM`](llms.BaseLLM.md)\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[deserialize](llms.BaseLLM.md#deserialize)

#### Defined in

[llms/base.ts:155](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L155)
