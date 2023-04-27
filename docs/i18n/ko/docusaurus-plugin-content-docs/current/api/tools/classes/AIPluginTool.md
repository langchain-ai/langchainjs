---
title: "AIPluginTool"
---

# AIPluginTool

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](Tool.md).**AIPluginTool**

## Implements

- `AIPluginToolParams`

## Constructors

### constructor()

> **new AIPluginTool**(`params`: `AIPluginToolParams`): [`AIPluginTool`](AIPluginTool.md)

#### Parameters

| Parameter | Type                 |
| :-------- | :------------------- |
| `params`  | `AIPluginToolParams` |

#### Returns

[`AIPluginTool`](AIPluginTool.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/aiplugin.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L24)

## Properties

### apiSpec

> **apiSpec**: `string`

#### Implementation of

AIPluginToolParams.apiSpec

#### Defined in

[langchain/src/tools/aiplugin.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L14)

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

## Accessors

### description

> **description**(): `string`

#### Returns

`string`

#### Implementation of

AIPluginToolParams.description

#### Overrides

Tool.description

#### Defined in

[langchain/src/tools/aiplugin.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L20)

#### Implementation of

AIPluginToolParams.description

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/aiplugin.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L20)

### name

> **name**(): `string`

#### Returns

`string`

#### Implementation of

AIPluginToolParams.name

#### Overrides

Tool.name

#### Defined in

[langchain/src/tools/aiplugin.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L16)

#### Implementation of

AIPluginToolParams.name

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/aiplugin.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L16)

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

### fromPluginUrl()

> `Static` **fromPluginUrl**(`url`: `string`): `Promise`<[`AIPluginTool`](AIPluginTool.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `url`     | `string` |

#### Returns

`Promise`<[`AIPluginTool`](AIPluginTool.md)\>

#### Defined in

[langchain/src/tools/aiplugin.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/aiplugin.ts#L36)
