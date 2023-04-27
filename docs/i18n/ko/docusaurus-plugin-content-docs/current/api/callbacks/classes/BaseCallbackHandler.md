---
title: "BaseCallbackHandler"
---

# BaseCallbackHandler

## Hierarchy

- `BaseCallbackHandlerMethodsClass`.**BaseCallbackHandler**

## Implements

- [`BaseCallbackHandlerInput`](../interfaces/BaseCallbackHandlerInput.md)

## Constructors

### constructor()

> **new BaseCallbackHandler**(`input`?: [`BaseCallbackHandlerInput`](../interfaces/BaseCallbackHandlerInput.md)): [`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `input?`  | [`BaseCallbackHandlerInput`](../interfaces/BaseCallbackHandlerInput.md) |

#### Returns

[`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Overrides

BaseCallbackHandlerMethodsClass.constructor

#### Defined in

[langchain/src/callbacks/base.ts:165](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L165)

## Properties

### ignoreAgent

> **ignoreAgent**: `boolean` = `false`

#### Implementation of

[BaseCallbackHandlerInput](../interfaces/BaseCallbackHandlerInput.md).[ignoreAgent](../interfaces/BaseCallbackHandlerInput.md#ignoreagent)

#### Defined in

[langchain/src/callbacks/base.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L163)

### ignoreChain

> **ignoreChain**: `boolean` = `false`

#### Implementation of

[BaseCallbackHandlerInput](../interfaces/BaseCallbackHandlerInput.md).[ignoreChain](../interfaces/BaseCallbackHandlerInput.md#ignorechain)

#### Defined in

[langchain/src/callbacks/base.ts:161](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L161)

### ignoreLLM

> **ignoreLLM**: `boolean` = `false`

#### Implementation of

[BaseCallbackHandlerInput](../interfaces/BaseCallbackHandlerInput.md).[ignoreLLM](../interfaces/BaseCallbackHandlerInput.md#ignorellm)

#### Defined in

[langchain/src/callbacks/base.ts:159](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L159)

### name

> `Abstract` **name**: `string`

#### Defined in

[langchain/src/callbacks/base.ts:157](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L157)

## Methods

### copy()

> **copy**(): [`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Returns

[`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Defined in

[langchain/src/callbacks/base.ts:174](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L174)

### handleAgentAction()?

Called when an agent is about to execute an action,
with the action and the run ID.

> `Optional` **handleAgentAction**(`action`: [`AgentAction`](../../schema/types/AgentAction.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `action`       | [`AgentAction`](../../schema/types/AgentAction.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleAgentAction

#### Defined in

[langchain/src/callbacks/base.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L125)

### handleAgentEnd()?

Called when an agent finishes execution, before it exits.
with the final output and the run ID.

> `Optional` **handleAgentEnd**(`action`: [`AgentFinish`](../../schema/types/AgentFinish.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `action`       | [`AgentFinish`](../../schema/types/AgentFinish.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleAgentEnd

#### Defined in

[langchain/src/callbacks/base.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L135)

### handleChainEnd()?

Called at the end of a Chain run, with the outputs and the run ID.

> `Optional` **handleChainEnd**(`outputs`: [`ChainValues`](../../schema/types/ChainValues.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `outputs`      | [`ChainValues`](../../schema/types/ChainValues.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleChainEnd

#### Defined in

[langchain/src/callbacks/base.ts:80](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L80)

### handleChainError()?

Called if a Chain run encounters an error

> `Optional` **handleChainError**(`err`: `any`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `err`          | `any`    |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleChainError

#### Defined in

[langchain/src/callbacks/base.ts:71](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L71)

### handleChainStart()?

Called at the start of a Chain run, with the chain name and inputs
and the run ID.

> `Optional` **handleChainStart**(`chain`: `object`, `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `chain`        | `object`                                           |
| `chain.name`   | `string`                                           |
| `inputs`       | [`ChainValues`](../../schema/types/ChainValues.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleChainStart

#### Defined in

[langchain/src/callbacks/base.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L61)

### handleLLMEnd()?

Called at the end of an LLM/ChatModel run, with the output and the run ID.

> `Optional` **handleLLMEnd**(`output`: [`LLMResult`](../../schema/types/LLMResult.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                           |
| :------------- | :--------------------------------------------- |
| `output`       | [`LLMResult`](../../schema/types/LLMResult.md) |
| `runId`        | `string`                                       |
| `parentRunId?` | `string`                                       |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleLLMEnd

#### Defined in

[langchain/src/callbacks/base.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L51)

### handleLLMError()?

Called if an LLM/ChatModel run encounters an error

> `Optional` **handleLLMError**(`err`: `any`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `err`          | `any`    |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleLLMError

#### Defined in

[langchain/src/callbacks/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L42)

### handleLLMNewToken()?

Called when an LLM/ChatModel in `streaming` mode produces a new token

> `Optional` **handleLLMNewToken**(`token`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `token`        | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleLLMNewToken

#### Defined in

[langchain/src/callbacks/base.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L33)

### handleLLMStart()?

Called at the start of an LLM or Chat Model run, with the prompt(s)
and the run ID.

> `Optional` **handleLLMStart**(`llm`: `object`, `prompts`: `string`[], `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type       |
| :------------- | :--------- |
| `llm`          | `object`   |
| `llm.name`     | `string`   |
| `prompts`      | `string`[] |
| `runId`        | `string`   |
| `parentRunId?` | `string`   |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleLLMStart

#### Defined in

[langchain/src/callbacks/base.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L23)

### handleText()?

> `Optional` **handleText**(`text`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `text`         | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleText

#### Defined in

[langchain/src/callbacks/base.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L115)

### handleToolEnd()?

Called at the end of a Tool run, with the tool output and the run ID.

> `Optional` **handleToolEnd**(`output`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `output`       | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleToolEnd

#### Defined in

[langchain/src/callbacks/base.ts:109](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L109)

### handleToolError()?

Called if a Tool run encounters an error

> `Optional` **handleToolError**(`err`: `any`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `err`          | `any`    |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleToolError

#### Defined in

[langchain/src/callbacks/base.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L100)

### handleToolStart()?

Called at the start of a Tool run, with the tool name and input
and the run ID.

> `Optional` **handleToolStart**(`tool`: `object`, `input`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `tool`         | `object` |
| `tool.name`    | `string` |
| `input`        | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseCallbackHandlerMethodsClass.handleToolStart

#### Defined in

[langchain/src/callbacks/base.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L90)

### fromMethods()

> `Static` **fromMethods**(`methods`: `BaseCallbackHandlerMethodsClass`): `Handler`

#### Parameters

| Parameter | Type                              |
| :-------- | :-------------------------------- |
| `methods` | `BaseCallbackHandlerMethodsClass` |

#### Returns

`Handler`

#### Defined in

[langchain/src/callbacks/base.ts:180](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L180)
