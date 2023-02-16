---
id: "index.internal.OpenAIInput"
title: "Interface: OpenAIInput"
sidebar_label: "OpenAIInput"
custom_edit_url: null
---

[index](../modules/).[internal](../modules/.internal).OpenAIInput

Input to OpenAI class.

## Hierarchy

- [`ModelParams`](.internal.ModelParams)

  ↳ **`OpenAIInput`**

## Implemented by

- [`OpenAI`](../classes/.OpenAI)

## Properties

### batchSize

• **batchSize**: `number`

Batch size to use when passing multiple documents to generate

#### Defined in

[llms/openai.ts:66](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L66)

___

### bestOf

• **bestOf**: `number`

Generates `bestOf` completions server side and returns the "best"

#### Inherited from

[ModelParams](.internal.ModelParams).[bestOf](.internal.ModelParams#bestof)

#### Defined in

[llms/openai.ts:45](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L45)

___

### frequencyPenalty

• **frequencyPenalty**: `number`

Penalizes repeated tokens according to frequency

#### Inherited from

[ModelParams](.internal.ModelParams).[frequencyPenalty](.internal.ModelParams#frequencypenalty)

#### Defined in

[llms/openai.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L36)

___

### logitBias

• `Optional` **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Inherited from

[ModelParams](.internal.ModelParams).[logitBias](.internal.ModelParams#logitbias)

#### Defined in

[llms/openai.ts:48](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L48)

___

### maxRetries

• **maxRetries**: `number`

Maximum number of retries to make when generating

#### Defined in

[llms/openai.ts:69](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L69)

___

### maxTokens

• **maxTokens**: `number`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Inherited from

[ModelParams](.internal.ModelParams).[maxTokens](.internal.ModelParams#maxtokens)

#### Defined in

[llms/openai.ts:30](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L30)

___

### modelKwargs

• `Optional` **modelKwargs**: [`Kwargs`](../modules/.internal#kwargs)

Holds any additional parameters that are valid to pass to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Defined in

[llms/openai.ts:63](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L63)

___

### modelName

• **modelName**: `string`

Model name to use

#### Defined in

[llms/openai.ts:57](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L57)

___

### n

• **n**: `number`

Number of completions to generate for each prompt

#### Inherited from

[ModelParams](.internal.ModelParams).[n](.internal.ModelParams#n)

#### Defined in

[llms/openai.ts:42](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L42)

___

### presencePenalty

• **presencePenalty**: `number`

Penalizes repeated tokens

#### Inherited from

[ModelParams](.internal.ModelParams).[presencePenalty](.internal.ModelParams#presencepenalty)

#### Defined in

[llms/openai.ts:39](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L39)

___

### stop

• `Optional` **stop**: `string`[]

List of stop words to use when generating

#### Defined in

[llms/openai.ts:72](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L72)

___

### temperature

• **temperature**: `number`

Sampling temperature to use

#### Inherited from

[ModelParams](.internal.ModelParams).[temperature](.internal.ModelParams#temperature)

#### Defined in

[llms/openai.ts:24](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L24)

___

### topP

• **topP**: `number`

Total probability mass of tokens to consider at each step

#### Inherited from

[ModelParams](.internal.ModelParams).[topP](.internal.ModelParams#topp)

#### Defined in

[llms/openai.ts:33](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L33)
