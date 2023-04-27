---
title: "BaseSingleActionAgent"
---

# BaseSingleActionAgent

## Hierarchy

- `BaseAgent`.**BaseSingleActionAgent**

## Constructors

### constructor()

> **new BaseSingleActionAgent**(): [`BaseSingleActionAgent`](BaseSingleActionAgent.md)

#### Returns

[`BaseSingleActionAgent`](BaseSingleActionAgent.md)

#### Inherited from

BaseAgent.constructor

## Accessors

### allowedTools

> **allowedTools**(): `undefined` \| `string`[]

#### Returns

`undefined` \| `string`[]

#### Inherited from

BaseAgent.allowedTools

#### Defined in

[langchain/src/agents/agent.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L39)

#### Inherited from

BaseAgent.allowedTools

#### Defined in

[langchain/src/agents/agent.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L39)

### inputKeys

> `Abstract` **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Inherited from

BaseAgent.inputKeys

#### Defined in

[langchain/src/agents/agent.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L33)

#### Inherited from

BaseAgent.inputKeys

#### Defined in

[langchain/src/agents/agent.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L33)

### returnValues

> **returnValues**(): `string`[]

#### Returns

`string`[]

#### Inherited from

BaseAgent.returnValues

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

#### Inherited from

BaseAgent.returnValues

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

## Methods

### \_agentActionType()

> **\_agentActionType**(): `string`

#### Returns

`string`

#### Overrides

BaseAgent.\_agentActionType

#### Defined in

[langchain/src/agents/agent.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L86)

### \_agentType()

Return the string type key uniquely identifying this class of agent.

> **\_agentType**(): `string`

#### Returns

`string`

#### Inherited from

BaseAgent.\_agentType

#### Defined in

[langchain/src/agents/agent.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L46)

### plan()

Decide what to do, given some input.

> `Abstract` **plan**(`steps`: [`AgentStep`](../../schema/types/AgentStep.md)[], `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter          | Type                                                            | Description                                                        |
| :----------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------- |
| `steps`            | [`AgentStep`](../../schema/types/AgentStep.md)[]                | Steps the LLM has taken so far, along with observations from each. |
| `inputs`           | [`ChainValues`](../../schema/types/ChainValues.md)              | User inputs.                                                       |
| `callbackManager?` | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) | Callback manager.                                                  |

#### Returns

`Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

Action specifying what tool to use.

#### Defined in

[langchain/src/agents/agent.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L99)

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

BaseAgent.prepareForOutput

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

BaseAgent.returnStoppedResponse

#### Defined in

[langchain/src/agents/agent.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L58)
