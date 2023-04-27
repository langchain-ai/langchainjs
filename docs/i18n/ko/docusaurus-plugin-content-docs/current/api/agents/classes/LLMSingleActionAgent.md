---
title: "LLMSingleActionAgent"
---

# LLMSingleActionAgent

## Hierarchy

- [`BaseSingleActionAgent`](BaseSingleActionAgent.md).**LLMSingleActionAgent**

## Constructors

### constructor()

> **new LLMSingleActionAgent**(`input`: [`LLMSingleActionAgentInput`](../interfaces/LLMSingleActionAgentInput.md)): [`LLMSingleActionAgent`](LLMSingleActionAgent.md)

#### Parameters

| Parameter | Type                                                                      |
| :-------- | :------------------------------------------------------------------------ |
| `input`   | [`LLMSingleActionAgentInput`](../interfaces/LLMSingleActionAgentInput.md) |

#### Returns

[`LLMSingleActionAgent`](LLMSingleActionAgent.md)

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[constructor](BaseSingleActionAgent.md#constructor)

#### Defined in

[langchain/src/agents/agent.ts:140](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L140)

## Properties

### llmChain

> **llmChain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/agents/agent.ts:134](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L134)

### outputParser

> **outputParser**: [`AgentActionOutputParser`](AgentActionOutputParser.md)

#### Defined in

[langchain/src/agents/agent.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L136)

### stop?

> **stop**: `string`[]

#### Defined in

[langchain/src/agents/agent.ts:138](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L138)

## Accessors

### allowedTools

> **allowedTools**(): `undefined` \| `string`[]

#### Returns

`undefined` \| `string`[]

#### Inherited from

BaseSingleActionAgent.allowedTools

#### Defined in

[langchain/src/agents/agent.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L39)

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[allowedTools](BaseSingleActionAgent.md#allowedtools)

#### Defined in

[langchain/src/agents/agent.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L39)

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseSingleActionAgent.inputKeys

#### Defined in

[langchain/src/agents/agent.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L147)

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[inputKeys](BaseSingleActionAgent.md#inputkeys)

#### Defined in

[langchain/src/agents/agent.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L147)

### returnValues

> **returnValues**(): `string`[]

#### Returns

`string`[]

#### Inherited from

BaseSingleActionAgent.returnValues

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[returnValues](BaseSingleActionAgent.md#returnvalues)

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

## Methods

### \_agentActionType()

> **\_agentActionType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[\_agentActionType](BaseSingleActionAgent.md#_agentactiontype)

#### Defined in

[langchain/src/agents/agent.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L86)

### \_agentType()

Return the string type key uniquely identifying this class of agent.

> **\_agentType**(): `string`

#### Returns

`string`

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[\_agentType](BaseSingleActionAgent.md#_agenttype)

#### Defined in

[langchain/src/agents/agent.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L46)

### plan()

Decide what to do given some input.

> **plan**(`steps`: [`AgentStep`](../../schema/types/AgentStep.md)[], `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter          | Type                                                            | Description                                                        |
| :----------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------- |
| `steps`            | [`AgentStep`](../../schema/types/AgentStep.md)[]                | Steps the LLM has taken so far, along with observations from each. |
| `inputs`           | [`ChainValues`](../../schema/types/ChainValues.md)              | User inputs.                                                       |
| `callbackManager?` | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) | Callback manager.                                                  |

#### Returns

`Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

Action specifying what tool to use.

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[plan](BaseSingleActionAgent.md#plan)

#### Defined in

[langchain/src/agents/agent.ts:160](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L160)

### prepareForOutput()

Prepare the agent for output, if needed

> **prepareForOutput**(`_returnValues`: `Record`<`string`, `any`\>, `_steps`: [`AgentStep`](../../schema/types/AgentStep.md)[]): `Promise`<`Record`<`string`, `any`\>\>

#### Parameters

| Parameter       | Type                                             |
| :-------------- | :----------------------------------------------- |
| `_returnValues` | `Record`<`string`, `any`\>                      |
| `_steps`        | [`AgentStep`](../../schema/types/AgentStep.md)[] |

#### Returns

`Promise`<`Record`<`string`, `any`\>\>

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[prepareForOutput](BaseSingleActionAgent.md#prepareforoutput)

#### Defined in

[langchain/src/agents/agent.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L77)

### returnStoppedResponse()

Return response when agent has been stopped due to max iterations

> **returnStoppedResponse**(`earlyStoppingMethod`: [`StoppingMethod`](../types/StoppingMethod.md), `_steps`: [`AgentStep`](../../schema/types/AgentStep.md)[], `_inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `_callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter             | Type                                                            |
| :-------------------- | :-------------------------------------------------------------- |
| `earlyStoppingMethod` | [`StoppingMethod`](../types/StoppingMethod.md)                  |
| `_steps`              | [`AgentStep`](../../schema/types/AgentStep.md)[]                |
| `_inputs`             | [`ChainValues`](../../schema/types/ChainValues.md)              |
| `_callbackManager?`   | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) |

#### Returns

`Promise`<[`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Inherited from

[BaseSingleActionAgent](BaseSingleActionAgent.md).[returnStoppedResponse](BaseSingleActionAgent.md#returnstoppedresponse)

#### Defined in

[langchain/src/agents/agent.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L58)
