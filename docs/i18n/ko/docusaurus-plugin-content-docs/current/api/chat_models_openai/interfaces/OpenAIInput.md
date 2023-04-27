---
title: "OpenAIInput"
---

# OpenAIInput

## Properties

### frequencyPenalty

> **frequencyPenalty**: `number`

Penalizes repeated tokens according to frequency

#### Defined in

[langchain/src/chat_models/openai.ts:80](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L80)

### modelName

> **modelName**: `string`

Model name to use

#### Defined in

[langchain/src/chat_models/openai.ts:101](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L101)

### n

> **n**: `number`

Number of chat completions to generate for each prompt

#### Defined in

[langchain/src/chat_models/openai.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L86)

### presencePenalty

> **presencePenalty**: `number`

Penalizes repeated tokens

#### Defined in

[langchain/src/chat_models/openai.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L83)

### streaming

> **streaming**: `boolean`

Whether to stream the results or not. Enabling disables tokenUsage reporting

#### Defined in

[langchain/src/chat_models/openai.ts:92](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L92)

### temperature

> **temperature**: `number`

Sampling temperature to use, between 0 and 2, defaults to 1

#### Defined in

[langchain/src/chat_models/openai.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L74)

### topP

> **topP**: `number`

Total probability mass of tokens to consider at each step, between 0 and 1, defaults to 1

#### Defined in

[langchain/src/chat_models/openai.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L77)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Defined in

[langchain/src/chat_models/openai.ts:89](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L89)

### maxTokens?

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion. If not specified,
defaults to the maximum number of tokens allowed by the model.

#### Defined in

[langchain/src/chat_models/openai.ts:98](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L98)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.create`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Defined in

[langchain/src/chat_models/openai.ts:107](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L107)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Defined in

[langchain/src/chat_models/openai.ts:110](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L110)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Defined in

[langchain/src/chat_models/openai.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/openai.ts#L115)
