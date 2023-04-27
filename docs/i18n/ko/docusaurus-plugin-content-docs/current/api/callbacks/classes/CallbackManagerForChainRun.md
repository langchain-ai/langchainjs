---
title: "CallbackManagerForChainRun"
---

# CallbackManagerForChainRun

## Hierarchy

- `BaseRunManager`.**CallbackManagerForChainRun**

## Implements

- `BaseCallbackManagerMethods`

## Constructors

### constructor()

> **new CallbackManagerForChainRun**(`runId`: `string`, `handlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `inheritableHandlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `_parentRunId`?: `string`): [`CallbackManagerForChainRun`](CallbackManagerForChainRun.md)

#### Parameters

| Parameter             | Type                                              |
| :-------------------- | :------------------------------------------------ |
| `runId`               | `string`                                          |
| `handlers`            | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `inheritableHandlers` | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `_parentRunId?`       | `string`                                          |

#### Returns

[`CallbackManagerForChainRun`](CallbackManagerForChainRun.md)

#### Inherited from

BaseRunManager.constructor

#### Defined in

[langchain/src/callbacks/manager.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L40)

## Properties

### runId

> `Readonly` **runId**: `string`

#### Inherited from

BaseRunManager.runId

#### Defined in

[langchain/src/callbacks/manager.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L41)

### handlers

> `Protected` `Readonly` **handlers**: [`BaseCallbackHandler`](BaseCallbackHandler.md)[]

#### Inherited from

BaseRunManager.handlers

#### Defined in

[langchain/src/callbacks/manager.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L42)

### inheritableHandlers

> `Protected` `Readonly` **inheritableHandlers**: [`BaseCallbackHandler`](BaseCallbackHandler.md)[]

#### Inherited from

BaseRunManager.inheritableHandlers

#### Defined in

[langchain/src/callbacks/manager.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L43)

### \_parentRunId?

> **\_parentRunId**: `string`

#### Inherited from

BaseRunManager.\_parentRunId

#### Defined in

[langchain/src/callbacks/manager.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L44)

## Methods

### getChild()

> **getChild**(): [`CallbackManager`](CallbackManager.md)

#### Returns

[`CallbackManager`](CallbackManager.md)

#### Defined in

[langchain/src/callbacks/manager.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L123)

### handleAgentAction()

> **handleAgentAction**(`action`: [`AgentAction`](../../schema/types/AgentAction.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `action`  | [`AgentAction`](../../schema/types/AgentAction.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleAgentAction

#### Defined in

[langchain/src/callbacks/manager.ts:170](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L170)

### handleAgentEnd()

> **handleAgentEnd**(`action`: [`AgentFinish`](../../schema/types/AgentFinish.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `action`  | [`AgentFinish`](../../schema/types/AgentFinish.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleAgentEnd

#### Defined in

[langchain/src/callbacks/manager.ts:190](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L190)

### handleChainEnd()

> **handleChainEnd**(`output`: [`ChainValues`](../../schema/types/ChainValues.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `output`  | [`ChainValues`](../../schema/types/ChainValues.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleChainEnd

#### Defined in

[langchain/src/callbacks/manager.ts:150](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L150)

### handleChainError()

> **handleChainError**(`err`: `unknown`): `Promise`<`void`\>

#### Parameters

| Parameter | Type      |
| :-------- | :-------- |
| `err`     | `unknown` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleChainError

#### Defined in

[langchain/src/callbacks/manager.ts:130](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L130)

### handleText()

> **handleText**(`text`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleText

#### Inherited from

BaseRunManager.handleText

#### Defined in

[langchain/src/callbacks/manager.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L47)
