---
title: "ZapierNLARunAction"
---

# ZapierNLARunAction

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](Tool.md).**ZapierNLARunAction**

## Constructors

### constructor()

> **new ZapierNLARunAction**(`apiWrapper`: [`ZapierNLAWrapper`](ZapierNLAWrapper.md), `actionId`: `string`, `zapierDescription`: `string`, `paramsSchema`: `ZapierValues`, `params`?: `ZapierValues`): [`ZapierNLARunAction`](ZapierNLARunAction.md)

#### Parameters

| Parameter           | Type                                      |
| :------------------ | :---------------------------------------- |
| `apiWrapper`        | [`ZapierNLAWrapper`](ZapierNLAWrapper.md) |
| `actionId`          | `string`                                  |
| `zapierDescription` | `string`                                  |
| `paramsSchema`      | `ZapierValues`                            |
| `params?`           | `ZapierValues`                            |

#### Returns

[`ZapierNLARunAction`](ZapierNLARunAction.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/zapier.ts:201](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L201)

## Properties

### actionId

> **actionId**: `string`

#### Defined in

[langchain/src/tools/zapier.ts:193](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L193)

### apiWrapper

> **apiWrapper**: [`ZapierNLAWrapper`](ZapierNLAWrapper.md)

#### Defined in

[langchain/src/tools/zapier.ts:191](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L191)

### description

> **description**: `string`

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/zapier.ts:199](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L199)

### name

> **name**: `string`

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/zapier.ts:197](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L197)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[Tool](Tool.md).[returnDirect](Tool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodEffects`<`ZodObject`<\{`input`: `ZodOptional`<`ZodString`\>;}, "strip", `ZodTypeAny`, \{`input`?: `string`;}, \{`input`?: `string`;}\>, `undefined` \| `string`, \{`input`?: `string`;}\>

#### Inherited from

[Tool](Tool.md).[schema](Tool.md#schema)

#### Defined in

[langchain/src/tools/base.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L59)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[Tool](Tool.md).[verbose](Tool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[Tool](Tool.md).[callbacks](Tool.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### params?

> **params**: `ZapierValues`

#### Defined in

[langchain/src/tools/zapier.ts:195](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/zapier.ts#L195)

## Methods

### call()

> **call**(`arg`: `undefined` \| `string` \| \{`input`?: `string`;}, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `arg`        | `undefined` \| `string` \| \{`input`?: `string`;} |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[Tool](Tool.md).[call](Tool.md#call)

#### Defined in

[langchain/src/tools/base.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L67)
