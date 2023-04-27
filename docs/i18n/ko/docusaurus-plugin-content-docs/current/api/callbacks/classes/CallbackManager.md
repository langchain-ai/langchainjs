---
title: "CallbackManager"
---

# CallbackManager

## Hierarchy

- `BaseCallbackManager`.**CallbackManager**

## Implements

- `BaseCallbackManagerMethods`

## Constructors

### constructor()

> **new CallbackManager**(`parentRunId`?: `string`): [`CallbackManager`](CallbackManager.md)

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `parentRunId?` | `string` |

#### Returns

[`CallbackManager`](CallbackManager.md)

#### Overrides

BaseCallbackManager.constructor

#### Defined in

[langchain/src/callbacks/manager.ts:271](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L271)

## Properties

### handlers

> **handlers**: [`BaseCallbackHandler`](BaseCallbackHandler.md)[]

#### Defined in

[langchain/src/callbacks/manager.ts:263](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L263)

### inheritableHandlers

> **inheritableHandlers**: [`BaseCallbackHandler`](BaseCallbackHandler.md)[]

#### Defined in

[langchain/src/callbacks/manager.ts:265](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L265)

### name

> **name**: `string` = `"callback_manager"`

#### Defined in

[langchain/src/callbacks/manager.ts:267](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L267)

## Methods

### addHandler()

> **addHandler**(`handler`: [`BaseCallbackHandler`](BaseCallbackHandler.md), `inherit`: `boolean` = `true`): `void`

#### Parameters

| Parameter | Type                                            | Default value |
| :-------- | :---------------------------------------------- | :------------ |
| `handler` | [`BaseCallbackHandler`](BaseCallbackHandler.md) | `undefined`   |
| `inherit` | `boolean`                                       | `true`        |

#### Returns

`void`

#### Overrides

BaseCallbackManager.addHandler

#### Defined in

[langchain/src/callbacks/manager.ts:371](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L371)

### copy()

> **copy**(`additionalHandlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[] = `[]`, `inherit`: `boolean` = `true`): [`CallbackManager`](CallbackManager.md)

#### Parameters

| Parameter            | Type                                              | Default value |
| :------------------- | :------------------------------------------------ | :------------ |
| `additionalHandlers` | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] | `[]`          |
| `inherit`            | `boolean`                                         | `true`        |

#### Returns

[`CallbackManager`](CallbackManager.md)

#### Defined in

[langchain/src/callbacks/manager.ts:393](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L393)

### handleChainStart()

> **handleChainStart**(`chain`: `object`, `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `runId`: `string` = `...`): `Promise`<[`CallbackManagerForChainRun`](CallbackManagerForChainRun.md)\>

#### Parameters

| Parameter    | Type                                               |
| :----------- | :------------------------------------------------- |
| `chain`      | `object`                                           |
| `chain.name` | `string`                                           |
| `inputs`     | [`ChainValues`](../../schema/types/ChainValues.md) |
| `runId`      | `string`                                           |

#### Returns

`Promise`<[`CallbackManagerForChainRun`](CallbackManagerForChainRun.md)\>

#### Implementation of

BaseCallbackManagerMethods.handleChainStart

#### Defined in

[langchain/src/callbacks/manager.ts:309](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L309)

### handleLLMStart()

> **handleLLMStart**(`llm`: `object`, `prompts`: `string`[], `runId`: `string` = `...`): `Promise`<[`CallbackManagerForLLMRun`](CallbackManagerForLLMRun.md)\>

#### Parameters

| Parameter  | Type       |
| :--------- | :--------- |
| `llm`      | `object`   |
| `llm.name` | `string`   |
| `prompts`  | `string`[] |
| `runId`    | `string`   |

#### Returns

`Promise`<[`CallbackManagerForLLMRun`](CallbackManagerForLLMRun.md)\>

#### Implementation of

BaseCallbackManagerMethods.handleLLMStart

#### Defined in

[langchain/src/callbacks/manager.ts:278](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L278)

### handleToolStart()

> **handleToolStart**(`tool`: `object`, `input`: `string`, `runId`: `string` = `...`): `Promise`<[`CallbackManagerForToolRun`](CallbackManagerForToolRun.md)\>

#### Parameters

| Parameter   | Type     |
| :---------- | :------- |
| `tool`      | `object` |
| `tool.name` | `string` |
| `input`     | `string` |
| `runId`     | `string` |

#### Returns

`Promise`<[`CallbackManagerForToolRun`](CallbackManagerForToolRun.md)\>

#### Implementation of

BaseCallbackManagerMethods.handleToolStart

#### Defined in

[langchain/src/callbacks/manager.ts:340](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L340)

### removeHandler()

> **removeHandler**(`handler`: [`BaseCallbackHandler`](BaseCallbackHandler.md)): `void`

#### Parameters

| Parameter | Type                                            |
| :-------- | :---------------------------------------------- |
| `handler` | [`BaseCallbackHandler`](BaseCallbackHandler.md) |

#### Returns

`void`

#### Overrides

BaseCallbackManager.removeHandler

#### Defined in

[langchain/src/callbacks/manager.ts:378](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L378)

### setHandler()

> **setHandler**(`handler`: [`BaseCallbackHandler`](BaseCallbackHandler.md)): `void`

#### Parameters

| Parameter | Type                                            |
| :-------- | :---------------------------------------------- |
| `handler` | [`BaseCallbackHandler`](BaseCallbackHandler.md) |

#### Returns

`void`

#### Inherited from

BaseCallbackManager.setHandler

#### Defined in

[langchain/src/callbacks/manager.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L34)

### setHandlers()

> **setHandlers**(`handlers`: [`BaseCallbackHandler`](BaseCallbackHandler.md)[], `inherit`: `boolean` = `true`): `void`

#### Parameters

| Parameter  | Type                                              | Default value |
| :--------- | :------------------------------------------------ | :------------ |
| `handlers` | [`BaseCallbackHandler`](BaseCallbackHandler.md)[] | `undefined`   |
| `inherit`  | `boolean`                                         | `true`        |

#### Returns

`void`

#### Overrides

BaseCallbackManager.setHandlers

#### Defined in

[langchain/src/callbacks/manager.ts:385](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L385)

### configure()

> `Static` **configure**(`inheritableHandlers`?: [`Callbacks`](../types/Callbacks.md), `localHandlers`?: [`Callbacks`](../types/Callbacks.md), `options`?: [`CallbackManagerOptions`](../interfaces/CallbackManagerOptions.md)): `Promise`<`undefined` \| [`CallbackManager`](CallbackManager.md)\>

#### Parameters

| Parameter              | Type                                                                |
| :--------------------- | :------------------------------------------------------------------ |
| `inheritableHandlers?` | [`Callbacks`](../types/Callbacks.md)                                |
| `localHandlers?`       | [`Callbacks`](../types/Callbacks.md)                                |
| `options?`             | [`CallbackManagerOptions`](../interfaces/CallbackManagerOptions.md) |

#### Returns

`Promise`<`undefined` \| [`CallbackManager`](CallbackManager.md)\>

#### Defined in

[langchain/src/callbacks/manager.ts:420](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L420)

### fromHandlers()

> `Static` **fromHandlers**(`handlers`: `BaseCallbackHandlerMethodsClass`): [`CallbackManager`](CallbackManager.md)

#### Parameters

| Parameter  | Type                              |
| :--------- | :-------------------------------- |
| `handlers` | `BaseCallbackHandlerMethodsClass` |

#### Returns

[`CallbackManager`](CallbackManager.md)

#### Defined in

[langchain/src/callbacks/manager.ts:405](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/manager.ts#L405)
