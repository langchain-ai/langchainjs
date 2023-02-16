---
id: "index.internal.ModelParams"
title: "Interface: ModelParams"
sidebar_label: "ModelParams"
custom_edit_url: null
---

[index](../modules/).[internal](../modules/.internal).ModelParams

## Hierarchy

- **`ModelParams`**

  ↳ [`OpenAIInput`](.internal.OpenAIInput)

## Properties

### bestOf

• **bestOf**: `number`

Generates `bestOf` completions server side and returns the "best"

#### Defined in

[llms/openai.ts:45](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L45)

___

### frequencyPenalty

• **frequencyPenalty**: `number`

Penalizes repeated tokens according to frequency

#### Defined in

[llms/openai.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L36)

___

### logitBias

• `Optional` **logitBias**: `Record`<`string`, `number`\>

Dictionary used to adjust the probability of specific tokens being generated

#### Defined in

[llms/openai.ts:48](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L48)

___

### maxTokens

• **maxTokens**: `number`

Maximum number of tokens to generate in the completion. -1 returns as many
tokens as possible given the prompt and the model's maximum context size.

#### Defined in

[llms/openai.ts:30](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L30)

___

### n

• **n**: `number`

Number of completions to generate for each prompt

#### Defined in

[llms/openai.ts:42](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L42)

___

### presencePenalty

• **presencePenalty**: `number`

Penalizes repeated tokens

#### Defined in

[llms/openai.ts:39](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L39)

___

### temperature

• **temperature**: `number`

Sampling temperature to use

#### Defined in

[llms/openai.ts:24](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L24)

___

### topP

• **topP**: `number`

Total probability mass of tokens to consider at each step

#### Defined in

[llms/openai.ts:33](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L33)
