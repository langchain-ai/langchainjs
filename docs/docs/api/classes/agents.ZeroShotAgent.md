---
id: "agents.ZeroShotAgent"
title: "Class: ZeroShotAgent"
sidebar_label: "ZeroShotAgent"
custom_edit_url: null
---

[agents](../modules/agents.md).ZeroShotAgent

Agent for the MRKL chain.

## Hierarchy

- [`Agent`](agents.Agent.md)

  ↳ **`ZeroShotAgent`**

## Constructors

### constructor

• **new ZeroShotAgent**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`AgentInput`](../interfaces/agents.AgentInput.md) |

#### Overrides

[Agent](agents.Agent.md).[constructor](agents.Agent.md#constructor)

#### Defined in

[agents/mrkl/index.ts:47](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L47)

## Properties

### allowedTools

• `Optional` **allowedTools**: `string`[] = `undefined`

#### Inherited from

[Agent](agents.Agent.md).[allowedTools](agents.Agent.md#allowedtools)

#### Defined in

[agents/agent.ts:66](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L66)

___

### llmChain

• **llmChain**: [`LLMChain`](.LLMChain)

#### Inherited from

[Agent](agents.Agent.md).[llmChain](agents.Agent.md#llmchain)

#### Defined in

[agents/agent.ts:64](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L64)

___

### returnValues

• **returnValues**: `string`[]

#### Inherited from

[Agent](agents.Agent.md).[returnValues](agents.Agent.md#returnvalues)

#### Defined in

[agents/agent.ts:68](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L68)

## Methods

### \_agentType

▸ **_agentType**(): ``"zero-shot-react-description"``

Return the string type key uniquely identifying this class of agent.

#### Returns

``"zero-shot-react-description"``

#### Overrides

[Agent](agents.Agent.md).[_agentType](agents.Agent.md#_agenttype)

#### Defined in

[agents/mrkl/index.ts:51](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L51)

___

### \_stop

▸ **_stop**(): `string`[]

#### Returns

`string`[]

#### Inherited from

[Agent](agents.Agent.md).[_stop](agents.Agent.md#_stop)

#### Defined in

[agents/agent.ts:108](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L108)

___

### extractToolAndInput

▸ **extractToolAndInput**(`text`): ``null`` \| { `input`: `string` ; `tool`: `string`  }

Extract tool and tool input from LLM output.

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

``null`` \| { `input`: `string` ; `tool`: `string`  }

#### Overrides

[Agent](agents.Agent.md).[extractToolAndInput](agents.Agent.md#extracttoolandinput)

#### Defined in

[agents/mrkl/index.ts:110](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L110)

___

### finishToolName

▸ **finishToolName**(): `string`

Name of tool to use to terminate the chain.

#### Returns

`string`

#### Inherited from

[Agent](agents.Agent.md).[finishToolName](agents.Agent.md#finishtoolname)

#### Defined in

[agents/agent.ts:115](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L115)

___

### llmPrefix

▸ **llmPrefix**(): `string`

Prefix to append the LLM call with.

#### Returns

`string`

#### Overrides

[Agent](agents.Agent.md).[llmPrefix](agents.Agent.md#llmprefix)

#### Defined in

[agents/mrkl/index.ts:59](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L59)

___

### observationPrefix

▸ **observationPrefix**(): `string`

Prefix to append the observation with.

#### Returns

`string`

#### Overrides

[Agent](agents.Agent.md).[observationPrefix](agents.Agent.md#observationprefix)

#### Defined in

[agents/mrkl/index.ts:55](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L55)

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

#### Inherited from

[Agent](agents.Agent.md).[plan](agents.Agent.md#plan)

#### Defined in

[agents/agent.ts:170](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L170)

___

### prepareForNewCall

▸ **prepareForNewCall**(): `void`

Prepare the agent for a new call, if needed

#### Returns

`void`

#### Inherited from

[Agent](agents.Agent.md).[prepareForNewCall](agents.Agent.md#preparefornewcall)

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

#### Inherited from

[Agent](agents.Agent.md).[returnStoppedResponse](agents.Agent.md#returnstoppedresponse)

#### Defined in

[agents/agent.ts:180](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/agent.ts#L180)

___

### createPrompt

▸ `Static` **createPrompt**(`tools`, `args?`): [`PromptTemplate`](.PromptTemplate)

Create prompt in the style of the zero shot agent.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tools` | [`Tool`](agents.Tool.md)[] | List of tools the agent will have access to, used to format the prompt. |
| `args?` | [`CreatePromptArgs`](../modules/agents.internal.md#createpromptargs) | Arguments to create the prompt with. |

#### Returns

[`PromptTemplate`](.PromptTemplate)

#### Defined in

[agents/mrkl/index.ts:82](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L82)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`ZeroShotAgent`](agents.ZeroShotAgent.md)\>

Load an agent from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | `Object` |

#### Returns

`Promise`<[`ZeroShotAgent`](agents.ZeroShotAgent.md)\>

#### Overrides

[Agent](agents.Agent.md).[deserialize](agents.Agent.md#deserialize)

#### Defined in

[agents/mrkl/index.ts:128](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L128)

___

### fromLLMAndTools

▸ `Static` **fromLLMAndTools**(`llm`, `tools`, `args?`): [`ZeroShotAgent`](agents.ZeroShotAgent.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `llm` | [`BaseLLM`](llms.BaseLLM.md) |
| `tools` | [`Tool`](agents.Tool.md)[] |
| `args?` | [`CreatePromptArgs`](../modules/agents.internal.md#createpromptargs) |

#### Returns

[`ZeroShotAgent`](agents.ZeroShotAgent.md)

#### Defined in

[agents/mrkl/index.ts:100](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L100)

___

### validateTools

▸ `Static` **validateTools**(`tools`): `void`

Validate that appropriate tools are passed in

#### Parameters

| Name | Type |
| :------ | :------ |
| `tools` | [`Tool`](agents.Tool.md)[] |

#### Returns

`void`

#### Overrides

[Agent](agents.Agent.md).[validateTools](agents.Agent.md#validatetools)

#### Defined in

[agents/mrkl/index.ts:63](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/mrkl/index.ts#L63)
