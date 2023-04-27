---
title: "CallbackManagerForToolRun"
---

# CallbackManagerForToolRun

## Hierarchy

- `BaseRunManager`.**CallbackManagerForToolRun**

## Implements

- `BaseCallbackManagerMethods`

## Constructors

### constructor()

> **new CallbackManagerForToolRun**(`runId`: `string`, `handlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `inheritableHandlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `_parentRunId`?: `string`): [`CallbackManagerForToolRun`](CallbackManagerForToolRun.md)

#### Parameters

| Parameter             | Type                                              |
| :-------------------- | :------------------------------------------------ |
| `runId`               | `string`                                          |
| `handlers`            | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `inheritableHandlers` | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `_parentRunId?`       | `string`                                          |

#### Returns

[`CallbackManagerForToolRun`](CallbackManagerForToolRun.md)

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

[langchain/src/callbacks/manager.ts:215](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L215)

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

### handleToolEnd()

> **handleToolEnd**(`output`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `output`  | `string` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleToolEnd

#### Defined in

[langchain/src/callbacks/manager.ts:238](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L238)

### handleToolError()

> **handleToolError**(`err`: `unknown`): `Promise`<`void`\>

#### Parameters

| Parameter | Type      |
| :-------- | :-------- |
| `err`     | `unknown` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleToolError

#### Defined in

[langchain/src/callbacks/manager.ts:222](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L222)
