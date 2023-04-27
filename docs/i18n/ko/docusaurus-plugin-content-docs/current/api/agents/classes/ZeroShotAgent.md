---
title: "ZeroShotAgent"
---

# ZeroShotAgent

Agent for the MRKL chain.

## Hierarchy

- [`Agent`](Agent.md).**ZeroShotAgent**

## Constructors

### constructor()

> **new ZeroShotAgent**(`input`: [`ZeroShotAgentInput`](../types/ZeroShotAgentInput.md)): [`ZeroShotAgent`](ZeroShotAgent.md)

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `input`   | [`ZeroShotAgentInput`](../types/ZeroShotAgentInput.md) |

#### Returns

[`ZeroShotAgent`](ZeroShotAgent.md)

#### Overrides

[Agent](Agent.md).[constructor](Agent.md#constructor)

#### Defined in

[langchain/src/agents/mrkl/index.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L33)

## Properties

### llmChain

> **llmChain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Inherited from

[Agent](Agent.md).[llmChain](Agent.md#llmchain)

#### Defined in

[langchain/src/agents/agent.ts:199](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L199)

### outputParser

> **outputParser**: [`AgentActionOutputParser`](AgentActionOutputParser.md)

#### Inherited from

[Agent](Agent.md).[outputParser](Agent.md#outputparser)

#### Defined in

[langchain/src/agents/agent.ts:201](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L201)

## Accessors

### allowedTools

> **allowedTools**(): `undefined` \| `string`[]

#### Returns

`undefined` \| `string`[]

#### Inherited from

Agent.allowedTools

#### Defined in

[langchain/src/agents/agent.ts:205](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L205)

#### Inherited from

[Agent](Agent.md).[allowedTools](Agent.md#allowedtools)

#### Defined in

[langchain/src/agents/agent.ts:205](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L205)

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Inherited from

Agent.inputKeys

#### Defined in

[langchain/src/agents/agent.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L209)

#### Inherited from

[Agent](Agent.md).[inputKeys](Agent.md#inputkeys)

#### Defined in

[langchain/src/agents/agent.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L209)

### returnValues

> **returnValues**(): `string`[]

#### Returns

`string`[]

#### Inherited from

Agent.returnValues

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

#### Inherited from

[Agent](Agent.md).[returnValues](Agent.md#returnvalues)

#### Defined in

[langchain/src/agents/agent.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L35)

## Methods

### \_agentActionType()

> **\_agentActionType**(): `string`

#### Returns

`string`

#### Inherited from

[Agent](Agent.md).[\_agentActionType](Agent.md#_agentactiontype)

#### Defined in

[langchain/src/agents/agent.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L86)

### \_agentType()

Return the string type key uniquely identifying this class of agent.

> **\_agentType**(): "zero-shot-react-description"

#### Returns

"zero-shot-react-description"

#### Overrides

[Agent](Agent.md).[\_agentType](Agent.md#_agenttype)

#### Defined in

[langchain/src/agents/mrkl/index.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L39)

### \_stop()

> **\_stop**(): `string`[]

#### Returns

`string`[]

#### Inherited from

[Agent](Agent.md).[\_stop](Agent.md#_stop)

#### Defined in

[langchain/src/agents/agent.ts:275](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L275)

### constructScratchPad()

Construct a scratchpad to let the agent continue its thought process

> **constructScratchPad**(`steps`: [`AgentStep`](../../schema/types/AgentStep.md)[]): `Promise`<`string` \| [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Parameters

| Parameter | Type                                             |
| :-------- | :----------------------------------------------- |
| `steps`   | [`AgentStep`](../../schema/types/AgentStep.md)[] |

#### Returns

`Promise`<`string` \| [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Inherited from

[Agent](Agent.md).[constructScratchPad](Agent.md#constructscratchpad)

#### Defined in

[langchain/src/agents/agent.ts:289](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L289)

### finishToolName()

Name of tool to use to terminate the chain.

> **finishToolName**(): `string`

#### Returns

`string`

#### Inherited from

[Agent](Agent.md).[finishToolName](Agent.md#finishtoolname)

#### Defined in

[langchain/src/agents/agent.ts:282](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L282)

### llmPrefix()

Prefix to append the LLM call with.

> **llmPrefix**(): `string`

#### Returns

`string`

#### Overrides

[Agent](Agent.md).[llmPrefix](Agent.md#llmprefix)

#### Defined in

[langchain/src/agents/mrkl/index.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L47)

### observationPrefix()

Prefix to append the observation with.

> **observationPrefix**(): `string`

#### Returns

`string`

#### Overrides

[Agent](Agent.md).[observationPrefix](Agent.md#observationprefix)

#### Defined in

[langchain/src/agents/mrkl/index.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L43)

### plan()

Decide what to do given some input.

> **plan**(`steps`: [`AgentStep`](../../schema/types/AgentStep.md)[], `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter          | Type                                                            | Description                                                        |
| :----------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------- |
| `steps`            | [`AgentStep`](../../schema/types/AgentStep.md)[]                | Steps the LLM has taken so far, along with observations from each. |
| `inputs`           | [`ChainValues`](../../schema/types/ChainValues.md)              | User inputs.                                                       |
| `callbackManager?` | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) | Callback manager to use for this call.                             |

#### Returns

`Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

Action specifying what tool to use.

#### Inherited from

[Agent](Agent.md).[plan](Agent.md#plan)

#### Defined in

[langchain/src/agents/agent.ts:333](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L333)

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

[Agent](Agent.md).[prepareForOutput](Agent.md#prepareforoutput)

#### Defined in

[langchain/src/agents/agent.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L77)

### returnStoppedResponse()

Return response when agent has been stopped due to max iterations

> **returnStoppedResponse**(`earlyStoppingMethod`: [`StoppingMethod`](../types/StoppingMethod.md), `steps`: [`AgentStep`](../../schema/types/AgentStep.md)[], `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter             | Type                                                            |
| :-------------------- | :-------------------------------------------------------------- |
| `earlyStoppingMethod` | [`StoppingMethod`](../types/StoppingMethod.md)                  |
| `steps`               | [`AgentStep`](../../schema/types/AgentStep.md)[]                |
| `inputs`              | [`ChainValues`](../../schema/types/ChainValues.md)              |
| `callbackManager?`    | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) |

#### Returns

`Promise`<[`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Inherited from

[Agent](Agent.md).[returnStoppedResponse](Agent.md#returnstoppedresponse)

#### Defined in

[langchain/src/agents/agent.ts:344](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L344)

### createPrompt()

Create prompt in the style of the zero shot agent.

> `Static` **createPrompt**(`tools`: [`Tool`](../../tools/classes/Tool.md)[], `args`?: [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md)): [`PromptTemplate`](../../prompts/classes/PromptTemplate.md)

#### Parameters

| Parameter | Type                                                                    | Description                                                             |
| :-------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `tools`   | [`Tool`](../../tools/classes/Tool.md)[]                                 | List of tools the agent will have access to, used to format the prompt. |
| `args?`   | [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md) | Arguments to create the prompt with.                                    |

#### Returns

[`PromptTemplate`](../../prompts/classes/PromptTemplate.md)

#### Overrides

[Agent](Agent.md).[createPrompt](Agent.md#createprompt)

#### Defined in

[langchain/src/agents/mrkl/index.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L74)

### deserialize()

Load an agent from a json-like object describing it.

> `Static` **deserialize**(`data`: `Object`): `Promise`<[`ZeroShotAgent`](ZeroShotAgent.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `data`    | `Object` |

#### Returns

`Promise`<[`ZeroShotAgent`](ZeroShotAgent.md)\>

#### Overrides

[Agent](Agent.md).[deserialize](Agent.md#deserialize)

#### Defined in

[langchain/src/agents/mrkl/index.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L122)

### fromLLMAndTools()

Construct an agent from an LLM and a list of tools

> `Static` **fromLLMAndTools**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `tools`: [`Tool`](../../tools/classes/Tool.md)[], `args`?: [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md) & [`AgentArgs`](../interfaces/AgentArgs.md)): [`ZeroShotAgent`](ZeroShotAgent.md)

#### Parameters

| Parameter | Type                                                                                                                |
| :-------- | :------------------------------------------------------------------------------------------------------------------ |
| `llm`     | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)                                             |
| `tools`   | [`Tool`](../../tools/classes/Tool.md)[]                                                                             |
| `args?`   | [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md) & [`AgentArgs`](../interfaces/AgentArgs.md) |

#### Returns

[`ZeroShotAgent`](ZeroShotAgent.md)

#### Overrides

[Agent](Agent.md).[fromLLMAndTools](Agent.md#fromllmandtools)

#### Defined in

[langchain/src/agents/mrkl/index.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L100)

### getDefaultOutputParser()

Get the default output parser for this agent.

> `Static` **getDefaultOutputParser**(`fields`?: [`OutputParserArgs`](../types/OutputParserArgs.md)): [`ZeroShotAgentOutputParser`](ZeroShotAgentOutputParser.md)

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `fields?` | [`OutputParserArgs`](../types/OutputParserArgs.md) |

#### Returns

[`ZeroShotAgentOutputParser`](ZeroShotAgentOutputParser.md)

#### Overrides

[Agent](Agent.md).[getDefaultOutputParser](Agent.md#getdefaultoutputparser)

#### Defined in

[langchain/src/agents/mrkl/index.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L51)

### validateTools()

Validate that appropriate tools are passed in

> `Static` **validateTools**(`tools`: [`Tool`](../../tools/classes/Tool.md)[]): `void`

#### Parameters

| Parameter | Type                                    |
| :-------- | :-------------------------------------- |
| `tools`   | [`Tool`](../../tools/classes/Tool.md)[] |

#### Returns

`void`

#### Overrides

[Agent](Agent.md).[validateTools](Agent.md#validatetools)

#### Defined in

[langchain/src/agents/mrkl/index.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/index.ts#L55)
