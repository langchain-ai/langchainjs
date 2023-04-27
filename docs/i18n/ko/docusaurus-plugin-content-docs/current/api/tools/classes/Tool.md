---
title: "Tool"
---

# Tool

Base class for language models, chains, tools.

## Hierarchy

- [`StructuredTool`](StructuredTool.md).**Tool**

## Constructors

### constructor()

> **new Tool**(`verbose`?: `boolean`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): [`Tool`](Tool.md)

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `verbose?`   | `boolean`                                         |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

[`Tool`](Tool.md)

#### Overrides

[StructuredTool](StructuredTool.md).[constructor](StructuredTool.md#constructor)

#### Defined in

[langchain/src/tools/base.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L63)

## Properties

### description

> `Abstract` **description**: `string`

#### Inherited from

[StructuredTool](StructuredTool.md).[description](StructuredTool.md#description)

#### Defined in

[langchain/src/tools/base.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L53)

### name

> `Abstract` **name**: `string`

#### Inherited from

[StructuredTool](StructuredTool.md).[name](StructuredTool.md#name)

#### Defined in

[langchain/src/tools/base.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L51)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[StructuredTool](StructuredTool.md).[returnDirect](StructuredTool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodEffects`<`ZodObject`<\{`input`: `ZodOptional`<`ZodString`\>;}, "strip", `ZodTypeAny`, \{`input`?: `string`;}, \{`input`?: `string`;}\>, `undefined` \| `string`, \{`input`?: `string`;}\>

#### Overrides

[StructuredTool](StructuredTool.md).[schema](StructuredTool.md#schema)

#### Defined in

[langchain/src/tools/base.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L59)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[StructuredTool](StructuredTool.md).[verbose](StructuredTool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[StructuredTool](StructuredTool.md).[callbacks](StructuredTool.md#callbacks)

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

#### Overrides

[StructuredTool](StructuredTool.md).[call](StructuredTool.md#call)

#### Defined in

[langchain/src/tools/base.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L67)

### \_call()

> `Protected` `Abstract` **\_call**(`arg`: `any`, `runManager`?: [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md)): `Promise`<`string`\>

#### Parameters

| Parameter     | Type                                                                                |
| :------------ | :---------------------------------------------------------------------------------- |
| `arg`         | `any`                                                                               |
| `runManager?` | [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[StructuredTool](StructuredTool.md).[\_call](StructuredTool.md#_call)

#### Defined in

[langchain/src/tools/base.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L21)
