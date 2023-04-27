---
title: "BaseLanguageModelParams"
---

# BaseLanguageModelParams

Base interface for language model parameters.
A subclass of [BaseLanguageModel](../classes/BaseLanguageModel.md) should have a constructor that
takes in a parameter that extends this interface.

## Hierarchy

- `AsyncCallerParams`.[`BaseLangChainParams`](BaseLangChainParams.md).**BaseLanguageModelParams**

## Properties

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Defined in

[langchain/src/base_language/index.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L48)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLangChainParams](BaseLangChainParams.md).[callbacks](BaseLangChainParams.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

AsyncCallerParams.maxConcurrency

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

AsyncCallerParams.maxRetries

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[BaseLangChainParams](BaseLangChainParams.md).[verbose](BaseLangChainParams.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
