---
title: "AgentExecutor"
---

# AgentExecutor

A chain managing an agent using tools.

## Hierarchy

- [`BaseChain`](../../chains/classes/BaseChain.md).**AgentExecutor**

## Constructors

### constructor()

> **new AgentExecutor**(`input`: [`AgentExecutorInput`](../interfaces/AgentExecutorInput.md)): [`AgentExecutor`](AgentExecutor.md)

#### Parameters

| Parameter | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `input`   | [`AgentExecutorInput`](../interfaces/AgentExecutorInput.md) |

#### Returns

[`AgentExecutor`](AgentExecutor.md)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[constructor](../../chains/classes/BaseChain.md#constructor)

#### Defined in

[langchain/src/agents/executor.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L45)

## Properties

### agent

> **agent**: [`BaseSingleActionAgent`](BaseSingleActionAgent.md) \| `BaseMultiActionAgent`

#### Defined in

[langchain/src/agents/executor.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L27)

### earlyStoppingMethod

> **earlyStoppingMethod**: [`StoppingMethod`](../types/StoppingMethod.md) = `"force"`

#### Defined in

[langchain/src/agents/executor.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L35)

### returnIntermediateSteps

> **returnIntermediateSteps**: `boolean` = `false`

#### Defined in

[langchain/src/agents/executor.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L31)

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Defined in

[langchain/src/agents/executor.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L29)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[verbose](../../chains/classes/BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[callbacks](../../chains/classes/BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### maxIterations?

> **maxIterations**: `number` = `15`

#### Defined in

[langchain/src/agents/executor.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L33)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[memory](../../chains/classes/BaseChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/agents/executor.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L37)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[inputKeys](../../chains/classes/BaseChain.md#inputkeys)

#### Defined in

[langchain/src/agents/executor.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L37)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/agents/executor.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L41)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[outputKeys](../../chains/classes/BaseChain.md#outputkeys)

#### Defined in

[langchain/src/agents/executor.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L41)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "agent_executor"

#### Returns

"agent_executor"

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[\_chainType](../../chains/classes/BaseChain.md#_chaintype)

#### Defined in

[langchain/src/agents/executor.ts:155](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L155)

### apply()

Call the chain on all inputs in the list

> **apply**(`inputs`: [`ChainValues`](../../schema/types/ChainValues.md)[], `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)[]): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                                 |
| :----------- | :--------------------------------------------------- |
| `inputs`     | [`ChainValues`](../../schema/types/ChainValues.md)[] |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)[]  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[apply](../../chains/classes/BaseChain.md#apply)

#### Defined in

[langchain/src/chains/base.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L123)

### call()

Run the core logic of this chain and add to output if desired.

Wraps \_call and handles memory.

> **call**(`values`: [`ChainValues`](../../schema/types/ChainValues.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                               |
| :----------- | :------------------------------------------------- |
| `values`     | [`ChainValues`](../../schema/types/ChainValues.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[call](../../chains/classes/BaseChain.md#call)

#### Defined in

[langchain/src/chains/base.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L84)

### run()

> **run**(`input`: `any`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `input`      | `any`                                             |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[run](../../chains/classes/BaseChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md)

#### Returns

[`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[serialize](../../chains/classes/BaseChain.md#serialize)

#### Defined in

[langchain/src/agents/executor.ts:159](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L159)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md), `values`: `LoadValues` = `{}`): `Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

#### Parameters

| Parameter | Type                                                               |
| :-------- | :----------------------------------------------------------------- |
| `data`    | [`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md) |
| `values`  | `LoadValues`                                                       |

#### Returns

`Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[deserialize](../../chains/classes/BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/base.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L135)

### fromAgentAndTools()

Create from agent and a list of tools.

> `Static` **fromAgentAndTools**(`fields`: [`AgentExecutorInput`](../interfaces/AgentExecutorInput.md)): [`AgentExecutor`](AgentExecutor.md)

#### Parameters

| Parameter | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `fields`  | [`AgentExecutorInput`](../interfaces/AgentExecutorInput.md) |

#### Returns

[`AgentExecutor`](AgentExecutor.md)

#### Defined in

[langchain/src/agents/executor.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L70)
