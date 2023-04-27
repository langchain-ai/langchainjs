---
title: "Calculator"
---

# Calculator

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](../../tools/classes/Tool.md).**Calculator**

## Constructors

### constructor()

> **new Calculator**(`verbose`?: `boolean`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): [`Calculator`](Calculator.md)

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `verbose?`   | `boolean`                                         |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

[`Calculator`](Calculator.md)

#### Inherited from

[Tool](../../tools/classes/Tool.md).[constructor](../../tools/classes/Tool.md#constructor)

#### Defined in

[langchain/src/tools/base.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L63)

## Properties

### description

> **description**: `string`

#### Overrides

[Tool](../../tools/classes/Tool.md).[description](../../tools/classes/Tool.md#description)

#### Defined in

[langchain/src/tools/calculator.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/calculator.ts#L17)

### name

> **name**: `string` = `"calculator"`

#### Overrides

[Tool](../../tools/classes/Tool.md).[name](../../tools/classes/Tool.md#name)

#### Defined in

[langchain/src/tools/calculator.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/calculator.ts#L6)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[Tool](../../tools/classes/Tool.md).[returnDirect](../../tools/classes/Tool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodEffects`<`ZodObject`<\{`input`: `ZodOptional`<`ZodString`\>;}, "strip", `ZodTypeAny`, \{`input`?: `string`;}, \{`input`?: `string`;}\>, `undefined` \| `string`, \{`input`?: `string`;}\>

#### Inherited from

[Tool](../../tools/classes/Tool.md).[schema](../../tools/classes/Tool.md#schema)

#### Defined in

[langchain/src/tools/base.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L59)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[Tool](../../tools/classes/Tool.md).[verbose](../../tools/classes/Tool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[Tool](../../tools/classes/Tool.md).[callbacks](../../tools/classes/Tool.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

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

[Tool](../../tools/classes/Tool.md).[call](../../tools/classes/Tool.md#call)

#### Defined in

[langchain/src/tools/base.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L67)
