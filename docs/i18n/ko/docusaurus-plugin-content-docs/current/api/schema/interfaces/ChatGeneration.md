---
title: "ChatGeneration"
---

# ChatGeneration

Output of a single generation.

## Hierarchy

- [`Generation`](Generation.md).**ChatGeneration**

## Properties

### message

> **message**: [`BaseChatMessage`](../classes/BaseChatMessage.md)

#### Defined in

[langchain/src/schema/index.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L99)

### text

> **text**: `string`

Generated text output

#### Inherited from

[Generation](Generation.md).[text](Generation.md#text)

#### Defined in

[langchain/src/schema/index.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L22)

### generationInfo?

> **generationInfo**: `Record`<`string`, `any`\>

Raw generation info response from the provider.
May include things like reason for finishing (e.g. in OpenAI)

#### Inherited from

[Generation](Generation.md).[generationInfo](Generation.md#generationinfo)

#### Defined in

[langchain/src/schema/index.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L28)
