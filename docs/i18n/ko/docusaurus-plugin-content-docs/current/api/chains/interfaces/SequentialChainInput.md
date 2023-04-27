---
title: "SequentialChainInput"
---

# SequentialChainInput

## Hierarchy

- [`ChainInputs`](ChainInputs.md).**SequentialChainInput**

## Properties

### chains

> **chains**: [`BaseChain`](../classes/BaseChain.md)[]

Array of chains to run as a sequence. The chains are run in order they appear in the array.

#### Defined in

[langchain/src/chains/sequential_chain.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L19)

### inputVariables

> **inputVariables**: `string`[]

Defines which variables should be passed as initial input to the first chain.

#### Defined in

[langchain/src/chains/sequential_chain.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L21)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[ChainInputs](ChainInputs.md).[callbackManager](ChainInputs.md#callbackmanager)

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[callbacks](ChainInputs.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[memory](ChainInputs.md#memory)

#### Defined in

[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)

### outputVariables?

> **outputVariables**: `string`[]

Which variables should be returned as a result of executing the chain. If not specified, output of the last of the chains is used.

#### Defined in

[langchain/src/chains/sequential_chain.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L23)

### returnAll?

> **returnAll**: `boolean`

Whether or not to return all intermediate outputs and variables (excluding initial input variables).

#### Defined in

[langchain/src/chains/sequential_chain.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L25)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[ChainInputs](ChainInputs.md).[verbose](ChainInputs.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
