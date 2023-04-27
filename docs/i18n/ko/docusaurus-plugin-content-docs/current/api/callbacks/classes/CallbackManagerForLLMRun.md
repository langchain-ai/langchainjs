---
title: "CallbackManagerForLLMRun"
---

# CallbackManagerForLLMRun

## Hierarchy

- `BaseRunManager`.**CallbackManagerForLLMRun**

## Implements

- `BaseCallbackManagerMethods`

## Constructors

### constructor()

> **new CallbackManagerForLLMRun**(`runId`: `string`, `handlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `inheritableHandlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `_parentRunId`?: `string`): [`CallbackManagerForLLMRun`](CallbackManagerForLLMRun.md)

#### Parameters

| Parameter             | Type                                              |
| :-------------------- | :------------------------------------------------ |
| `runId`               | `string`                                          |
| `handlers`            | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `inheritableHandlers` | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] |
| `_parentRunId?`       | `string`                                          |

#### Returns

[`CallbackManagerForLLMRun`](CallbackManagerForLLMRun.md)

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

### handleLLMEnd()

> **handleLLMEnd**(`output`: [`LLMResult`](../../schema/types/LLMResult.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                           |
| :-------- | :--------------------------------------------- |
| `output`  | [`LLMResult`](../../schema/types/LLMResult.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleLLMEnd

#### Defined in

[langchain/src/callbacks/manager.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L102)

### handleLLMError()

> **handleLLMError**(`err`: `unknown`): `Promise`<`void`\>

#### Parameters

| Parameter | Type      |
| :-------- | :-------- |
| `err`     | `unknown` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleLLMError

#### Defined in

[langchain/src/callbacks/manager.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L86)

### handleLLMNewToken()

> **handleLLMNewToken**(`token`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `token`   | `string` |

#### Returns

`Promise`<`void`\>

#### Implementation of

BaseCallbackManagerMethods.handleLLMNewToken

#### Defined in

[langchain/src/callbacks/manager.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L66)

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
