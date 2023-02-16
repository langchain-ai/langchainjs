---
id: "agents"
title: "Module: agents"
sidebar_label: "agents"
sidebar_position: 0
custom_edit_url: null
---

## Modules

- [internal](agents.internal.md)

## Classes

- [Agent](../classes/agents.Agent.md)
- [AgentExecutor](../classes/agents.AgentExecutor.md)
- [Tool](../classes/agents.Tool.md)
- [ZeroShotAgent](../classes/agents.ZeroShotAgent.md)

## Interfaces

- [AgentInput](../interfaces/agents.AgentInput.md)
- [StaticAgent](../interfaces/agents.StaticAgent.md)

## Type Aliases

### AgentAction

Ƭ **AgentAction**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `log` | `string` |
| `tool` | `string` |
| `toolInput` | `string` |

#### Defined in

[agents/types.ts:4](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/types.ts#L4)

___

### AgentFinish

Ƭ **AgentFinish**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `log` | `string` |
| `returnValues` | `Record`<`string`, `any`\> |

#### Defined in

[agents/types.ts:10](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/types.ts#L10)

___

### AgentStep

Ƭ **AgentStep**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `action` | [`AgentAction`](agents.md#agentaction) |
| `observation` | `string` |

#### Defined in

[agents/types.ts:16](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/types.ts#L16)

___

### SerializedAgentT

Ƭ **SerializedAgentT**<`TType`, `FromLLMInput`, `ConstructorInput`\>: { `_type`: `TType` ; `llm_chain?`: [`SerializedLLMChain`](chains.md#serializedllmchain) ; `llm_chain_path?`: `string`  } & { `load_from_llm_and_tools`: ``true``  } & `FromLLMInput` \| { `load_from_llm_and_tools?`: ``false``  } & `ConstructorInput`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TType` | extends `string` |
| `FromLLMInput` | `FromLLMInput` |
| `ConstructorInput` | extends [`AgentInput`](../interfaces/agents.AgentInput.md) |

#### Defined in

[agents/types.ts:23](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/types.ts#L23)

___

### SerializedZeroShotAgent

Ƭ **SerializedZeroShotAgent**: [`SerializedAgentT`](agents.md#serializedagentt)<``"zero-shot-react-description"``, [`SerializedFromLLMAndTools`](agents.internal.md#serializedfromllmandtools), [`AgentInput`](../interfaces/agents.AgentInput.md)\>

#### Defined in

[agents/mrkl/index.ts:23](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/mrkl/index.ts#L23)

___

### StoppingMethod

Ƭ **StoppingMethod**: ``"force"`` \| ``"generate"``

#### Defined in

[agents/types.ts:21](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/types.ts#L21)

## Functions

### loadAgent

▸ **loadAgent**(`uri`, `llmAndTools?`): `Promise`<[`Agent`](../classes/agents.Agent.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `uri` | `string` |
| `llmAndTools?` | `Object` |
| `llmAndTools.llm?` | [`BaseLLM`](../classes/llms.BaseLLM.md) |
| `llmAndTools.tools?` | [`Tool`](../classes/agents.Tool.md)[] |

#### Returns

`Promise`<[`Agent`](../classes/agents.Agent.md)\>

#### Defined in

[agents/load.ts:14](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/load.ts#L14)

___

### staticImplements

▸ **staticImplements**<`T`\>(`_`): `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `_` | `T` |

#### Returns

`void`

#### Defined in

[agents/agent.ts:47](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/agent.ts#L47)
