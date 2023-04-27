---
title: "JsonSpec"
---

# JsonSpec

## Constructors

### constructor()

> **new JsonSpec**(`obj`: [`JsonObject`](../types/JsonObject.md), `max_value_length`: `number` = `4000`): [`JsonSpec`](JsonSpec.md)

#### Parameters

| Parameter          | Type                                   | Default value |
| :----------------- | :------------------------------------- | :------------ |
| `obj`              | [`JsonObject`](../types/JsonObject.md) | `undefined`   |
| `max_value_length` | `number`                               | `4000`        |

#### Returns

[`JsonSpec`](JsonSpec.md)

#### Defined in

[langchain/src/tools/json.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/json.ts#L19)

## Properties

### maxValueLength

> **maxValueLength**: `number` = `4000`

#### Defined in

[langchain/src/tools/json.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/json.ts#L17)

### obj

> **obj**: [`JsonObject`](../types/JsonObject.md)

#### Defined in

[langchain/src/tools/json.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/json.ts#L15)

## Methods

### getKeys()

> **getKeys**(`input`: `string`): `string`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `input`   | `string` |

#### Returns

`string`

#### Defined in

[langchain/src/tools/json.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/json.ts#L24)

### getValue()

> **getValue**(`input`: `string`): `string`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `input`   | `string` |

#### Returns

`string`

#### Defined in

[langchain/src/tools/json.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/json.ts#L36)
