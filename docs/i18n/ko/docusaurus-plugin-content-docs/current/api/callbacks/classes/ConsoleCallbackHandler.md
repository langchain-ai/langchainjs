---
title: "ConsoleCallbackHandler"
---

# ConsoleCallbackHandler

## Hierarchy

- [`BaseCallbackHandler`](BaseCallbackHandler.md).**ConsoleCallbackHandler**

## Constructors

### constructor()

> **new ConsoleCallbackHandler**(`input`?: [`BaseCallbackHandlerInput`](../interfaces/BaseCallbackHandlerInput.md)): [`ConsoleCallbackHandler`](ConsoleCallbackHandler.md)

#### Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `input?`  | [`BaseCallbackHandlerInput`](../interfaces/BaseCallbackHandlerInput.md) |

#### Returns

[`ConsoleCallbackHandler`](ConsoleCallbackHandler.md)

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[constructor](BaseCallbackHandler.md#constructor)

#### Defined in

[langchain/src/callbacks/base.ts:165](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L165)

## Properties

### ignoreAgent

> **ignoreAgent**: `boolean` = `false`

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[ignoreAgent](BaseCallbackHandler.md#ignoreagent)

#### Defined in

[langchain/src/callbacks/base.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L163)

### ignoreChain

> **ignoreChain**: `boolean` = `false`

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[ignoreChain](BaseCallbackHandler.md#ignorechain)

#### Defined in

[langchain/src/callbacks/base.ts:161](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L161)

### ignoreLLM

> **ignoreLLM**: `boolean` = `false`

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[ignoreLLM](BaseCallbackHandler.md#ignorellm)

#### Defined in

[langchain/src/callbacks/base.ts:159](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L159)

### name

> **name**: `string` = `"console_callback_handler"`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[name](BaseCallbackHandler.md#name)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L10)

## Methods

### copy()

> **copy**(): [`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Returns

[`BaseCallbackHandler`](BaseCallbackHandler.md)

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[copy](BaseCallbackHandler.md#copy)

#### Defined in

[langchain/src/callbacks/base.ts:174](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L174)

### handleAgentAction()

Called when an agent is about to execute an action,
with the action and the run ID.

> **handleAgentAction**(`action`: [`AgentAction`](../../schema/types/AgentAction.md)): `void`

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `action`  | [`AgentAction`](../../schema/types/AgentAction.md) |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleAgentAction](BaseCallbackHandler.md#handleagentaction)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L37)

### handleAgentEnd()

Called when an agent finishes execution, before it exits.
with the final output and the run ID.

> **handleAgentEnd**(`action`: [`AgentFinish`](../../schema/types/AgentFinish.md)): `void`

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `action`  | [`AgentFinish`](../../schema/types/AgentFinish.md) |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleAgentEnd](BaseCallbackHandler.md#handleagentend)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L49)

### handleChainEnd()

Called at the end of a Chain run, with the outputs and the run ID.

> **handleChainEnd**(`_output`: [`ChainValues`](../../schema/types/ChainValues.md)): `void`

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `_output` | [`ChainValues`](../../schema/types/ChainValues.md) |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleChainEnd](BaseCallbackHandler.md#handlechainend)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L33)

### handleChainStart()

Called at the start of a Chain run, with the chain name and inputs
and the run ID.

> **handleChainStart**(`chain`: `object`): `void`

#### Parameters

| Parameter    | Type     |
| :----------- | :------- |
| `chain`      | `object` |
| `chain.name` | `string` |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleChainStart](BaseCallbackHandler.md#handlechainstart)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L29)

### handleLLMEnd()

Called at the end of an LLM/ChatModel run, with the output and the run ID.

> **handleLLMEnd**(`output`: [`LLMResult`](../../schema/types/LLMResult.md), `runId`: `string`): `void`

#### Parameters

| Parameter | Type                                           |
| :-------- | :--------------------------------------------- |
| `output`  | [`LLMResult`](../../schema/types/LLMResult.md) |
| `runId`   | `string`                                       |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleLLMEnd](BaseCallbackHandler.md#handlellmend)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L25)

### handleLLMError()

Called if an LLM/ChatModel run encounters an error

> **handleLLMError**(`err`: `any`, `runId`: `string`): `void`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `err`     | `any`    |
| `runId`   | `string` |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleLLMError](BaseCallbackHandler.md#handlellmerror)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L21)

### handleLLMStart()

Called at the start of an LLM or Chat Model run, with the prompt(s)
and the run ID.

> **handleLLMStart**(`llm`: `object`, `prompts`: `string`[], `runId`: `string`): `void`

#### Parameters

| Parameter  | Type       |
| :--------- | :--------- |
| `llm`      | `object`   |
| `llm.name` | `string`   |
| `prompts`  | `string`[] |
| `runId`    | `string`   |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleLLMStart](BaseCallbackHandler.md#handlellmstart)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L12)

### handleText()

> **handleText**(`text`: `string`): `void`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleText](BaseCallbackHandler.md#handletext)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L45)

### handleToolEnd()

Called at the end of a Tool run, with the tool output and the run ID.

> **handleToolEnd**(`output`: `string`): `void`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `output`  | `string` |

#### Returns

`void`

#### Overrides

[BaseCallbackHandler](BaseCallbackHandler.md).[handleToolEnd](BaseCallbackHandler.md#handletoolend)

#### Defined in

[langchain/src/callbacks/handlers/console.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/console.ts#L41)

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

[BaseCallbackHandler](BaseCallbackHandler.md).[handleChainError](BaseCallbackHandler.md#handlechainerror)

#### Defined in

[langchain/src/callbacks/base.ts:71](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L71)

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

[BaseCallbackHandler](BaseCallbackHandler.md).[handleLLMNewToken](BaseCallbackHandler.md#handlellmnewtoken)

#### Defined in

[langchain/src/callbacks/base.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L33)

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

[BaseCallbackHandler](BaseCallbackHandler.md).[handleToolError](BaseCallbackHandler.md#handletoolerror)

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

[BaseCallbackHandler](BaseCallbackHandler.md).[handleToolStart](BaseCallbackHandler.md#handletoolstart)

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

#### Inherited from

[BaseCallbackHandler](BaseCallbackHandler.md).[fromMethods](BaseCallbackHandler.md#frommethods)

#### Defined in

[langchain/src/callbacks/base.ts:180](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L180)
