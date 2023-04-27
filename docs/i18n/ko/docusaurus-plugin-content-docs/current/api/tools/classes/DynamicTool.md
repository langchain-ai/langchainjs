---
title: "DynamicTool"
---

# DynamicTool

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](Tool.md).**DynamicTool**

## Constructors

### constructor()

> **new DynamicTool**(`fields`: [`DynamicToolInput`](../interfaces/DynamicToolInput.md)): [`DynamicTool`](DynamicTool.md)

#### Parameters

| Parameter | Type                                                    |
| :-------- | :------------------------------------------------------ |
| `fields`  | [`DynamicToolInput`](../interfaces/DynamicToolInput.md) |

#### Returns

[`DynamicTool`](DynamicTool.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/dynamic.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L23)

## Properties

### description

> **description**: `string`

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/dynamic.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L19)

### func

> **func**: `Function`

#### Type declaration

> (`input`: `string`, `runManager`?: [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md)): `Promise`<`string`\>

##### Parameters

| Parameter     | Type                                                                                |
| :------------ | :---------------------------------------------------------------------------------- |
| `input`       | `string`                                                                            |
| `runManager?` | [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md) |

##### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/dynamic.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L21)

### name

> **name**: `string`

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/dynamic.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L17)

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
