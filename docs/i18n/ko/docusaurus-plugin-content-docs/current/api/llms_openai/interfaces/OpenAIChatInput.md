---
title: "OpenAIChatInput"
---

# OpenAIChatInput

Input to OpenAI class.

## Properties

### frequencyPenalty

> **frequencyPenalty**: `number`

Penalizes repeated tokens according to frequency

#### Defined in

[langchain/src/llms/openai-chat.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L27)

### modelName

> **modelName**: `string`

Model name to use

#### Defined in

[langchain/src/llms/openai-chat.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L42)

### n

> **n**: `number`

Number of chat completions to generate for each prompt

#### Defined in

[langchain/src/llms/openai-chat.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L33)

### presencePenalty

> **presencePenalty**: `number`

Penalizes repeated tokens

#### Defined in

[langchain/src/llms/openai-chat.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L30)

### streaming

> **streaming**: `boolean`

Whether to stream the results or not

#### Defined in

[langchain/src/llms/openai-chat.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L39)

### temperature

> **temperature**: `number`

Sampling temperature to use, between 0 and 2, defaults to 1

#### Defined in

[langchain/src/llms/openai-chat.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L21)

### topP

> **topP**: `number`

Total probability mass of tokens to consider at each step, between 0 and 1, defaults to 1

#### Defined in

[langchain/src/llms/openai-chat.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L24)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Defined in

[langchain/src/llms/openai-chat.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L36)

### maxTokens?

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion. If not specified,
defaults to the maximum number of tokens allowed by the model.

#### Defined in

[langchain/src/llms/openai-chat.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L65)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.create`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Defined in

[langchain/src/llms/openai-chat.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L51)

### prefixMessages?

> **prefixMessages**: `ChatCompletionRequestMessage`[]

ChatGPT messages to pass as a prefix to the prompt

#### Defined in

[langchain/src/llms/openai-chat.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L45)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Defined in

[langchain/src/llms/openai-chat.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L54)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Defined in

[langchain/src/llms/openai-chat.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai-chat.ts#L59)
