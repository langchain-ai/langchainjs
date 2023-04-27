---
title: "AgentExecutorInput"
---

# AgentExecutorInput

## Hierarchy

- [`ChainInputs`](../../chains/interfaces/ChainInputs.md).**AgentExecutorInput**

## Properties

### agent

> **agent**: [`BaseSingleActionAgent`](../classes/BaseSingleActionAgent.md) \| `BaseMultiActionAgent`

#### Defined in

[langchain/src/agents/executor.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L15)

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Defined in

[langchain/src/agents/executor.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L16)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[ChainInputs](../../chains/interfaces/ChainInputs.md).[callbackManager](../../chains/interfaces/ChainInputs.md#callbackmanager)

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[ChainInputs](../../chains/interfaces/ChainInputs.md).[callbacks](../../chains/interfaces/ChainInputs.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### earlyStoppingMethod?

> **earlyStoppingMethod**: [`StoppingMethod`](../types/StoppingMethod.md)

#### Defined in

[langchain/src/agents/executor.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L19)

### maxIterations?

> **maxIterations**: `number`

#### Defined in

[langchain/src/agents/executor.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L18)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[ChainInputs](../../chains/interfaces/ChainInputs.md).[memory](../../chains/interfaces/ChainInputs.md#memory)

#### Defined in

[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)

### returnIntermediateSteps?

> **returnIntermediateSteps**: `boolean`

#### Defined in

[langchain/src/agents/executor.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L17)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[ChainInputs](../../chains/interfaces/ChainInputs.md).[verbose](../../chains/interfaces/ChainInputs.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
