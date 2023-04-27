---
title: "BaseLLMParams"
---

# BaseLLMParams

Base interface for language model parameters.
A subclass of [BaseLanguageModel](../../base_language/classes/BaseLanguageModel.md) should have a constructor that
takes in a parameter that extends this interface.

## Hierarchy

- [`BaseLanguageModelParams`](../../base_language/interfaces/BaseLanguageModelParams.md).**BaseLLMParams**

## Properties

### cache?

> **cache**: `boolean` \| [`BaseCache`](../../schema/classes/BaseCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Defined in

[langchain/src/llms/base.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L31)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[BaseLanguageModelParams](../../base_language/interfaces/BaseLanguageModelParams.md).[callbackManager](../../base_language/interfaces/BaseLanguageModelParams.md#callbackmanager)

#### Defined in

[langchain/src/base_language/index.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L48)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLanguageModelParams](../../base_language/interfaces/BaseLanguageModelParams.md).[callbacks](../../base_language/interfaces/BaseLanguageModelParams.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### concurrency?

> **concurrency**: `number`

#### Deprecated

Use `maxConcurrency` instead

#### Defined in

[langchain/src/llms/base.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/llms/base.ts#L30)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

[BaseLanguageModelParams](../../base_language/interfaces/BaseLanguageModelParams.md).[maxConcurrency](../../base_language/interfaces/BaseLanguageModelParams.md#maxconcurrency)

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

[BaseLanguageModelParams](../../base_language/interfaces/BaseLanguageModelParams.md).[maxRetries](../../base_language/interfaces/BaseLanguageModelParams.md#maxretries)

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[BaseLanguageModelParams](../../base_language/interfaces/BaseLanguageModelParams.md).[verbose](../../base_language/interfaces/BaseLanguageModelParams.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
