---
title: "AWSLambda"
---

# AWSLambda

Base class for language models, chains, tools.

## Hierarchy

- [`DynamicTool`](../../tools/classes/DynamicTool.md).**AWSLambda**

## Constructors

### constructor()

> **new AWSLambda**(«destructured»: `LambdaConfig` & `Omit`<[`DynamicToolInput`](../../tools/interfaces/DynamicToolInput.md), "func"\>): [`AWSLambda`](AWSLambda.md)

#### Parameters

| Parameter        | Type                                                                                                |
| :--------------- | :-------------------------------------------------------------------------------------------------- |
| `«destructured»` | `LambdaConfig` & `Omit`<[`DynamicToolInput`](../../tools/interfaces/DynamicToolInput.md), "func"\> |

#### Returns

[`AWSLambda`](AWSLambda.md)

#### Overrides

[DynamicTool](../../tools/classes/DynamicTool.md).[constructor](../../tools/classes/DynamicTool.md#constructor)

#### Defined in

[langchain/src/tools/aws_lambda.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aws_lambda.ts#L21)

## Properties

### description

> **description**: `string`

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[description](../../tools/classes/DynamicTool.md#description)

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

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[func](../../tools/classes/DynamicTool.md#func)

#### Defined in

[langchain/src/tools/dynamic.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L21)

### name

> **name**: `string`

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[name](../../tools/classes/DynamicTool.md#name)

#### Defined in

[langchain/src/tools/dynamic.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/dynamic.ts#L17)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[returnDirect](../../tools/classes/DynamicTool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodEffects`<`ZodObject`<\{`input`: `ZodOptional`<`ZodString`\>;}, "strip", `ZodTypeAny`, \{`input`?: `string`;}, \{`input`?: `string`;}\>, `undefined` \| `string`, \{`input`?: `string`;}\>

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[schema](../../tools/classes/DynamicTool.md#schema)

#### Defined in

[langchain/src/tools/base.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L59)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[verbose](../../tools/classes/DynamicTool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[DynamicTool](../../tools/classes/DynamicTool.md).[callbacks](../../tools/classes/DynamicTool.md#callbacks)

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

[DynamicTool](../../tools/classes/DynamicTool.md).[call](../../tools/classes/DynamicTool.md#call)

#### Defined in

[langchain/src/tools/base.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L67)
