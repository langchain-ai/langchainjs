---
title: "CohereInput"
---

# CohereInput

Base interface for language model parameters.
A subclass of [BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md) should have a constructor that
takes in a parameter that extends this interface.

## Hierarchy

- [`BaseLLMParams`](../../llms_base/interfaces/BaseLLMParams.md).**CohereInput**

## Properties

### apiKey?

> **apiKey**: `string`

#### Defined in

[langchain/src/llms/cohere.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L15)

### cache?

> **cache**: `boolean` \| [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[cache](../../llms_base/interfaces/BaseLLMParams.md#cache)

#### Defined in

[langchain/src/llms/base.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L31)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[callbackManager](../../llms_base/interfaces/BaseLLMParams.md#callbackmanager)

#### Defined in

[langchain/src/base_language/index.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L48)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[callbacks](../../llms_base/interfaces/BaseLLMParams.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### concurrency?

> **concurrency**: `number`

#### Deprecated

Use `maxConcurrency` instead

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[concurrency](../../llms_base/interfaces/BaseLLMParams.md#concurrency)

#### Defined in

[langchain/src/llms/base.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L30)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[maxConcurrency](../../llms_base/interfaces/BaseLLMParams.md#maxconcurrency)

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[maxRetries](../../llms_base/interfaces/BaseLLMParams.md#maxretries)

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### maxTokens?

> **maxTokens**: `number`

Maximum number of tokens to generate in the completion.

#### Defined in

[langchain/src/llms/cohere.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L10)

### model?

> **model**: `string`

Model to use

#### Defined in

[langchain/src/llms/cohere.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L13)

### temperature?

> **temperature**: `number`

Sampling temperature to use

#### Defined in

[langchain/src/llms/cohere.ts:5](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/cohere.ts#L5)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[BaseLLMParams](../../llms_base/interfaces/BaseLLMParams.md).[verbose](../../llms_base/interfaces/BaseLLMParams.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
