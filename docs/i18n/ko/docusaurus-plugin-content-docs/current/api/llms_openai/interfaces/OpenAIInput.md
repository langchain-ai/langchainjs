---
title: "OpenAIInput"
---

# OpenAIInput

Input to OpenAI class.

## Properties

### batchSize

> **batchSize**: `number`

Batch size to use when passing multiple documents to generate

#### Defined in

[langchain/src/llms/openai.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L64)

### bestOf

> **bestOf**: `number`

Generates `bestOf` completions server side and returns the "best"

#### Defined in

[langchain/src/llms/openai.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L46)

### frequencyPenalty

> **frequencyPenalty**: `number`

Penalizes repeated tokens according to frequency

#### Defined in

[langchain/src/llms/openai.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L37)

### maxTokens

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Defined in

[langchain/src/llms/openai.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L31)

### modelName

> **modelName**: `string`

Model name to use

#### Defined in

[langchain/src/llms/openai.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L55)

### n

> **n**: `number`

Number of completions to generate for each prompt

#### Defined in

[langchain/src/llms/openai.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L43)

### presencePenalty

> **presencePenalty**: `number`

Penalizes repeated tokens

#### Defined in

[langchain/src/llms/openai.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L40)

### streaming

> **streaming**: `boolean`

Whether to stream the results or not. Enabling disables tokenUsage reporting

#### Defined in

[langchain/src/llms/openai.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L52)

### temperature

> **temperature**: `number`

Sampling temperature to use

#### Defined in

[langchain/src/llms/openai.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L25)

### topP

> **topP**: `number`

Total probability mass of tokens to consider at each step

#### Defined in

[langchain/src/llms/openai.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L34)

### logitBias?

> **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Defined in

[langchain/src/llms/openai.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L49)

### modelKwargs?

> **modelKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`openai.createCompletion`](https://platform.openai.com/docs/api-reference/completions/create) that are not explicitly specified on this class.

#### Defined in

[langchain/src/llms/openai.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L61)

### stop?

> **stop**: `string`[]

List of stop words to use when generating

#### Defined in

[langchain/src/llms/openai.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L67)

### timeout?

> **timeout**: `number`

Timeout to use when making requests to OpenAI.

#### Defined in

[langchain/src/llms/openai.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/openai.ts#L72)
