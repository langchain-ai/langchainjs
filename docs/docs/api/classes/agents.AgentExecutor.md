---
id: "agents.AgentExecutor"
title: "Class: AgentExecutor"
sidebar_label: "AgentExecutor"
custom_edit_url: null
---

[agents](../modules/agents.md).AgentExecutor

A chain managing an agent using tools.

## Hierarchy

- [`BaseChain`](chains.BaseChain.md)

  ↳ **`AgentExecutor`**

## Constructors

### constructor

• **new AgentExecutor**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`AgentExecutorInput`](../modules/agents.internal.md#agentexecutorinput) |

#### Overrides

[BaseChain](chains.BaseChain.md).[constructor](chains.BaseChain.md#constructor)

#### Defined in

[agents/executor.ts:28](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L28)

## Properties

### agent

• **agent**: [`Agent`](agents.Agent.md)

#### Defined in

[agents/executor.ts:18](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L18)

___

### earlyStoppingMethod

• **earlyStoppingMethod**: [`StoppingMethod`](../modules/agents.md#stoppingmethod) = `"force"`

#### Defined in

[agents/executor.ts:26](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L26)

___

### maxIterations

• `Optional` **maxIterations**: `number` = `15`

#### Defined in

[agents/executor.ts:24](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L24)

___

### returnIntermediateSteps

• **returnIntermediateSteps**: `boolean` = `false`

#### Defined in

[agents/executor.ts:22](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L22)

___

### tools

• **tools**: [`Tool`](agents.Tool.md)[]

#### Defined in

[agents/executor.ts:20](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L20)

## Methods

### \_call

▸ **_call**(`inputs`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and return the output

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Overrides

[BaseChain](chains.BaseChain.md).[_call](chains.BaseChain.md#_call)

#### Defined in

[agents/executor.ts:54](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L54)

___

### \_chainType

▸ **_chainType**(): ``"agent_executor"``

Return the string type key uniquely identifying this class of chain.

#### Returns

``"agent_executor"``

#### Overrides

[BaseChain](chains.BaseChain.md).[_chainType](chains.BaseChain.md#_chaintype)

#### Defined in

[agents/executor.ts:99](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L99)

___

### apply

▸ **apply**(`inputs`): [`ChainValues`](../modules/chains.md#chainvalues)[]

Call the chain on all inputs in the list

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues)[] |

#### Returns

[`ChainValues`](../modules/chains.md#chainvalues)[]

#### Inherited from

[BaseChain](chains.BaseChain.md).[apply](chains.BaseChain.md#apply)

#### Defined in

[chains/base.ts:43](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L43)

___

### call

▸ **call**(`values`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and add to output if desired.

Eventually will handle memory, validation, etc. but for now just wraps [_call](agents.AgentExecutor.md#_call)

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Inherited from

[BaseChain](chains.BaseChain.md).[call](chains.BaseChain.md#call)

#### Defined in

[chains/base.ts:35](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L35)

___

### serialize

▸ **serialize**(): [`SerializedLLMChain`](../modules/chains.md#serializedllmchain)

Return a json-like object representing this chain.

#### Returns

[`SerializedLLMChain`](../modules/chains.md#serializedllmchain)

#### Overrides

[BaseChain](chains.BaseChain.md).[serialize](chains.BaseChain.md#serialize)

#### Defined in

[agents/executor.ts:103](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L103)

___

### shouldContinue

▸ `Private` **shouldContinue**(`iterations`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `iterations` | `number` |

#### Returns

`boolean`

#### Defined in

[agents/executor.ts:50](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L50)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`BaseChain`](chains.BaseChain.md)\>

Load a chain from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedBaseChain`](../modules/agents.internal.md#serializedbasechain) |

#### Returns

`Promise`<[`BaseChain`](chains.BaseChain.md)\>

#### Inherited from

[BaseChain](chains.BaseChain.md).[deserialize](chains.BaseChain.md#deserialize)

#### Defined in

[chains/base.ts:50](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L50)

___

### fromAgentAndTools

▸ `Static` **fromAgentAndTools**(`fields`): [`AgentExecutor`](agents.AgentExecutor.md)

Create from agent and a list of tools.

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | { `agent`: [`Agent`](agents.Agent.md) ; `tools`: [`Tool`](agents.Tool.md)[]  } & `Record`<`string`, `any`\> |

#### Returns

[`AgentExecutor`](agents.AgentExecutor.md)

#### Defined in

[agents/executor.ts:40](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L40)
