---
title: "Agent"
---

# Agent

Class responsible for calling a language model and deciding an action.

## Remarks

This is driven by an LLMChain. The prompt in the LLMChain _must_
include a variable called "agent_scratchpad" where the agent can put its
intermediary work.

## Hierarchy

- [`BaseSingleActionAgent`](BaseSingleActionAgent.md).**Agent**

## Constructors

### constructor()

> **new Agent**(`input`: [`AgentInput`](../interfaces/AgentInput.md)): [`Agent`](Agent.md)

#### Parameters

| Parameter | Type                                        |
| :-------- | :------------------------------------------ |
| `input`   | [`AgentInput`](../interfaces/AgentInput.md) |

#### Returns

[`Agent`](Agent.md)

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[constructor](BaseSingleActionAgent.md#constructor)

#### Defined in

[langchain/src/agents/agent.ts:213](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L213)

## Properties

### llmChain

> **llmChain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/agents/agent.ts:199](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L199)

### outputParser

> **outputParser**: [`AgentActionOutputParser`](AgentActionOutputParser.md)

#### Defined in

[langchain/src/agents/agent.ts:201](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L201)

## Accessors

### allowedTools

> **allowedTools**(): `undefined` \| `string`[]

#### Returns

`undefined` \| `string`[]

#### Overrides

BaseSingleActionAgent.allowedTools

#### Defined in

[langchain/src/agents/agent.ts:205](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L205)

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[allowedTools](BaseSingleActionAgent.md#allowedtools)

#### Defined in

[langchain/src/agents/agent.ts:205](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L205)

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseSingleActionAgent.inputKeys

#### Defined in

[langchain/src/agents/agent.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L209)

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[inputKeys](BaseSingleActionAgent.md#inputkeys)

#### Defined in

[langchain/src/agents/agent.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L209)

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

> `Abstract` **\_agentType**(): `string`

#### Returns

`string`

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[\_agentType](BaseSingleActionAgent.md#_agenttype)

#### Defined in

[langchain/src/agents/agent.ts:233](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L233)

### \_stop()

> **\_stop**(): `string`[]

#### Returns

`string`[]

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

#### Defined in

[langchain/src/agents/agent.ts:289](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L289)

### finishToolName()

Name of tool to use to terminate the chain.

> **finishToolName**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/agents/agent.ts:282](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L282)

### llmPrefix()

Prefix to append the LLM call with.

> `Abstract` **llmPrefix**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/agents/agent.ts:228](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L228)

### observationPrefix()

Prefix to append the observation with.

> `Abstract` **observationPrefix**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/agents/agent.ts:223](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L223)

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

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[plan](BaseSingleActionAgent.md#plan)

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

[BaseSingleActionAgent](BaseSingleActionAgent.md).[prepareForOutput](BaseSingleActionAgent.md#prepareforoutput)

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

#### Overrides

[BaseSingleActionAgent](BaseSingleActionAgent.md).[returnStoppedResponse](BaseSingleActionAgent.md#returnstoppedresponse)

#### Defined in

[langchain/src/agents/agent.ts:344](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L344)

### createPrompt()

Create a prompt for this class

> `Static` **createPrompt**(`_tools`: [`Tool`](../../tools/classes/Tool.md)[], `_fields`?: `Record`<`string`, `any`\>): [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Parameters

| Parameter  | Type                                    | Description                                                             |
| :--------- | :-------------------------------------- | :---------------------------------------------------------------------- |
| `_tools`   | [`Tool`](../../tools/classes/Tool.md)[] | List of tools the agent will have access to, used to format the prompt. |
| `_fields?` | `Record`<`string`, `any`\>             | Additional fields used to format the prompt.                            |

#### Returns

[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

A PromptTemplate assembled from the given tools and fields.

#### Defined in

[langchain/src/agents/agent.ts:252](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L252)

### deserialize()

Load an agent from a json-like object describing it.

> `Static` **deserialize**(`data`: `Object`): `Promise`<[`Agent`](Agent.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `data`    | `Object` |

#### Returns

`Promise`<[`Agent`](Agent.md)\>

#### Defined in

[langchain/src/agents/agent.ts:386](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L386)

### fromLLMAndTools()

Construct an agent from an LLM and a list of tools

> `Static` **fromLLMAndTools**(`_llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `_tools`: [`Tool`](../../tools/classes/Tool.md)[], `_args`?: [`AgentArgs`](../interfaces/AgentArgs.md)): [`Agent`](Agent.md)

#### Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `_llm`    | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `_tools`  | [`Tool`](../../tools/classes/Tool.md)[]                                 |
| `_args?`  | [`AgentArgs`](../interfaces/AgentArgs.md)                               |

#### Returns

[`Agent`](Agent.md)

#### Defined in

[langchain/src/agents/agent.ts:261](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L261)

### getDefaultOutputParser()

Get the default output parser for this agent.

> `Static` **getDefaultOutputParser**(`_fields`?: [`OutputParserArgs`](../types/OutputParserArgs.md)): [`AgentActionOutputParser`](AgentActionOutputParser.md)

#### Parameters

| Parameter  | Type                                               |
| :--------- | :------------------------------------------------- |
| `_fields?` | [`OutputParserArgs`](../types/OutputParserArgs.md) |

#### Returns

[`AgentActionOutputParser`](AgentActionOutputParser.md)

#### Defined in

[langchain/src/agents/agent.ts:238](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L238)

### validateTools()

Validate that appropriate tools are passed in

> `Static` **validateTools**(`_tools`: [`Tool`](../../tools/classes/Tool.md)[]): `void`

#### Parameters

| Parameter | Type                                    |
| :-------- | :-------------------------------------- |
| `_tools`  | [`Tool`](../../tools/classes/Tool.md)[] |

#### Returns

`void`

#### Defined in

[langchain/src/agents/agent.ts:273](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent.ts#L273)
