---
id: "agents.Agent"
title: "Class: Agent"
sidebar_label: "Agent"
custom_edit_url: null
---

[agents](../modules/agents.md).Agent

Class responsible for calling a language model and deciding an action.

**`Remarks`**

This is driven by an LLMChain. The prompt in the LLMChain *must*
include a variable called "agent_scratchpad" where the agent can put its
intermediary work.

## Hierarchy

- **`Agent`**

  ↳ [`ZeroShotAgent`](agents.ZeroShotAgent.md)

## Constructors

### constructor

• **new Agent**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`AgentInput`](../interfaces/agents.AgentInput.md) |

#### Defined in

[agents/agent.ts:70](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L70)

## Properties

### allowedTools

• `Optional` **allowedTools**: `string`[] = `undefined`

#### Defined in

[agents/agent.ts:66](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L66)

___

### llmChain

• **llmChain**: [`LLMChain`](.LLMChain)

#### Defined in

[agents/agent.ts:64](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L64)

___

### returnValues

• **returnValues**: `string`[]

#### Defined in

[agents/agent.ts:68](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L68)

## Methods

### \_agentType

▸ `Abstract` **_agentType**(): `string`

Return the string type key uniquely identifying this class of agent.

#### Returns

`string`

#### Defined in

[agents/agent.ts:95](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L95)

___

### \_plan

▸ `Private` **_plan**(`steps`, `inputs`, `suffix?`): `Promise`<[`AgentAction`](../modules/agents.md#agentaction) \| [`AgentFinish`](../modules/agents.md#agentfinish)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `steps` | [`AgentStep`](../modules/agents.md#agentstep)[] |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues) |
| `suffix?` | `string` |

#### Returns

`Promise`<[`AgentAction`](../modules/agents.md#agentaction) \| [`AgentFinish`](../modules/agents.md#agentfinish)\>

#### Defined in

[agents/agent.ts:135](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L135)

___

### \_stop

▸ **_stop**(): `string`[]

#### Returns

`string`[]

#### Defined in

[agents/agent.ts:108](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L108)

___

### constructScratchPad

▸ `Private` **constructScratchPad**(`steps`): `string`

Construct a scratchpad to let the agent continue its thought process

#### Parameters

| Name | Type |
| :------ | :------ |
| `steps` | [`AgentStep`](../modules/agents.md#agentstep)[] |

#### Returns

`string`

#### Defined in

[agents/agent.ts:122](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L122)

___

### extractToolAndInput

▸ `Abstract` **extractToolAndInput**(`input`): ``null`` \| { `input`: `string` ; `tool`: `string`  }

Extract tool and tool input from LLM output.

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `string` |

#### Returns

``null`` \| { `input`: `string` ; `tool`: `string`  }

#### Defined in

[agents/agent.ts:78](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L78)

___

### finishToolName

▸ **finishToolName**(): `string`

Name of tool to use to terminate the chain.

#### Returns

`string`

#### Defined in

[agents/agent.ts:115](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L115)

___

### llmPrefix

▸ `Abstract` **llmPrefix**(): `string`

Prefix to append the LLM call with.

#### Returns

`string`

#### Defined in

[agents/agent.ts:90](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L90)

___

### observationPrefix

▸ `Abstract` **observationPrefix**(): `string`

Prefix to append the observation with.

#### Returns

`string`

#### Defined in

[agents/agent.ts:85](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L85)

___

### plan

▸ **plan**(`steps`, `inputs`): `Promise`<[`AgentAction`](../modules/agents.md#agentaction) \| [`AgentFinish`](../modules/agents.md#agentfinish)\>

Decide what to do given some input.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `steps` | [`AgentStep`](../modules/agents.md#agentstep)[] | Steps the LLM has taken so far, along with observations from each. |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues) | User inputs. |

#### Returns

`Promise`<[`AgentAction`](../modules/agents.md#agentaction) \| [`AgentFinish`](../modules/agents.md#agentfinish)\>

Action specifying what tool to use.

#### Defined in

[agents/agent.ts:170](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L170)

___

### prepareForNewCall

▸ **prepareForNewCall**(): `void`

Prepare the agent for a new call, if needed

#### Returns

`void`

#### Defined in

[agents/agent.ts:100](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L100)

___

### returnStoppedResponse

▸ **returnStoppedResponse**(`earlyStoppingMethod`, `steps`, `inputs`): `Promise`<[`AgentFinish`](../modules/agents.md#agentfinish)\>

Return response when agent has been stopped due to max iterations

#### Parameters

| Name | Type |
| :------ | :------ |
| `earlyStoppingMethod` | [`StoppingMethod`](../modules/agents.md#stoppingmethod) |
| `steps` | [`AgentStep`](../modules/agents.md#agentstep)[] |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`AgentFinish`](../modules/agents.md#agentfinish)\>

#### Defined in

[agents/agent.ts:180](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L180)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`Agent`](agents.Agent.md)\>

Load an agent from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | `Object` |

#### Returns

`Promise`<[`Agent`](agents.Agent.md)\>

#### Defined in

[agents/agent.ts:218](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L218)

___

### validateTools

▸ `Static` **validateTools**(`_`): `void`

Validate that appropriate tools are passed in

#### Parameters

| Name | Type |
| :------ | :------ |
| `_` | [`Tool`](agents.Tool.md)[] |

#### Returns

`void`

#### Defined in

[agents/agent.ts:106](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L106)
