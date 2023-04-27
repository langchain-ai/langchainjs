---
title: "BaseLangChain"
---

# BaseLangChain

Base class for language models, chains, tools.

## Hierarchy

- [`BaseLanguageModel`](BaseLanguageModel.md)
- [`StructuredTool`](../../tools/classes/StructuredTool.md)
- [`BaseChain`](../../chains/classes/BaseChain.md)

## Implements

- [`BaseLangChainParams`](../interfaces/BaseLangChainParams.md)

## Constructors

### constructor()

> **new BaseLangChain**(`params`: [`BaseLangChainParams`](../interfaces/BaseLangChainParams.md)): [`BaseLangChain`](BaseLangChain.md)

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `params`  | [`BaseLangChainParams`](../interfaces/BaseLangChainParams.md) |

#### Returns

[`BaseLangChain`](BaseLangChain.md)

#### Defined in

[langchain/src/base_language/index.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L31)

## Properties

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[BaseLangChainParams](../interfaces/BaseLangChainParams.md).[verbose](../interfaces/BaseLangChainParams.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[BaseLangChainParams](../interfaces/BaseLangChainParams.md).[callbacks](../interfaces/BaseLangChainParams.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)
