---
title: "ZapierNLAWrapper"
---

# ZapierNLAWrapper

## Constructors

### constructor()

> **new ZapierNLAWrapper**(`params`?: `string` \| [`ZapiterNLAWrapperParams`](../interfaces/ZapiterNLAWrapperParams.md)): [`ZapierNLAWrapper`](ZapierNLAWrapper.md)

#### Parameters

| Parameter | Type                                                                              |
| :-------- | :-------------------------------------------------------------------------------- |
| `params?` | `string` \| [`ZapiterNLAWrapperParams`](../interfaces/ZapiterNLAWrapperParams.md) |

#### Returns

[`ZapierNLAWrapper`](ZapierNLAWrapper.md)

#### Defined in

[langchain/src/tools/zapier.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L33)

## Properties

### caller

> **caller**: `AsyncCaller`

#### Defined in

[langchain/src/tools/zapier.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L31)

### zapierNlaApiBase

> **zapierNlaApiBase**: `string` = `"https://nla.zapier.com/api/v1/"`

#### Defined in

[langchain/src/tools/zapier.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L29)

### zapierNlaApiKey

> **zapierNlaApiKey**: `string`

#### Defined in

[langchain/src/tools/zapier.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L27)

## Methods

### listActions()

Returns a list of all exposed (enabled) actions associated with
current user (associated with the set api_key). Change your exposed
actions here: https://nla.zapier.com/demo/start/

> **listActions**(): `Promise`<`ZapierValues`[]\>

#### Returns

`Promise`<`ZapierValues`[]\>

#### Defined in

[langchain/src/tools/zapier.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L135)

### listActionsAsString()

Same as list, but returns a stringified version of the result.

> **listActionsAsString**(): `Promise`<`string`\>

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/zapier.ts:184](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L184)

### previewAction()

Same as run, but instead of actually executing the action, will
instead return a preview of params that have been guessed by the AI in
case you need to explicitly review before executing.

> **previewAction**(`actionId`: `string`, `instructions`: `string`, `params`?: `ZapierValues`): `Promise`<`ZapierValues`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `actionId`     | `string`       |
| `instructions` | `string`       |
| `params?`      | `ZapierValues` |

#### Returns

`Promise`<`ZapierValues`\>

#### Defined in

[langchain/src/tools/zapier.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L119)

### previewAsString()

Same as preview, but returns a stringified version of the result.

> **previewAsString**(`actionId`: `string`, `instructions`: `string`, `params`?: `ZapierValues`): `Promise`<`string`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `actionId`     | `string`       |
| `instructions` | `string`       |
| `params?`      | `ZapierValues` |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/zapier.ts:172](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L172)

### runAction()

Executes an action that is identified by action_id, must be exposed
(enabled) by the current user (associated with the set api_key). Change
your exposed actions here: https://nla.zapier.com/demo/start/

> **runAction**(`actionId`: `string`, `instructions`: `string`, `params`?: `ZapierValues`): `Promise`<`ZapierValues`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `actionId`     | `string`       |
| `instructions` | `string`       |
| `params?`      | `ZapierValues` |

#### Returns

`Promise`<`ZapierValues`\>

#### Defined in

[langchain/src/tools/zapier.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L102)

### runAsString()

Same as run, but returns a stringified version of the result.

> **runAsString**(`actionId`: `string`, `instructions`: `string`, `params`?: `ZapierValues`): `Promise`<`string`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `actionId`     | `string`       |
| `instructions` | `string`       |
| `params?`      | `ZapierValues` |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/zapier.ts:157](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L157)

### \_getActionRequest()

> `Protected` **\_getActionRequest**(`actionId`: `string`, `instructions`: `string`, `params`?: `ZapierValues`): `Promise`<`ZapierValues`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `actionId`     | `string`       |
| `instructions` | `string`       |
| `params?`      | `ZapierValues` |

#### Returns

`Promise`<`ZapierValues`\>

#### Defined in

[langchain/src/tools/zapier.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L59)

### \_getHeaders()

> `Protected` **\_getHeaders**(): `Record`<`string`, `string`\>

#### Returns

`Record`<`string`, `string`\>

#### Defined in

[langchain/src/tools/zapier.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L51)
